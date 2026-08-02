import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import {
  MAIL_CONFIG_KEYS,
  MAIL_LOCALES,
  MAIL_TEMPLATE_TYPES,
  PASSWORD_PLACEHOLDER,
  type MailEncryption,
  type MailLocale,
  type MailTemplateType,
} from './mail.constants';
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  maskEmail,
  sanitizeErrorMessage,
} from './mail-crypto.util';

export type SmtpPublicConfig = {
  host: string;
  port: number;
  username: string;
  password: typeof PASSWORD_PLACEHOLDER | '';
  passwordConfigured: boolean;
  encryption: MailEncryption;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  connectionTimeoutMs: number;
  configured: boolean;
};

export type CodePolicy = {
  length: number;
  ttlSeconds: number;
  intervalSeconds: number;
  dailyLimit: number;
  maxRetries: number;
};

export type SendMailResult =
  | { mode: 'sent'; messageId?: string; logId: number }
  | { mode: 'dev'; reason: string };

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly prisma: PrismaService) {}

  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  private isDevCodeEnabled(): boolean {
    return String(process.env.MAIL_DEV_CODE_ENABLED || 'false').toLowerCase() === 'true';
  }

  private async getConfigMap(): Promise<Map<string, string>> {
    const rows = await this.prisma.systemConfig.findMany({
      where: { group: { in: ['smtp', 'mail'] } },
    });
    return new Map(rows.map((r) => [r.key, r.value]));
  }

  private async upsertConfig(
    key: string,
    value: string,
    group: string,
    secret: boolean,
    updatedBy?: number,
  ) {
    await this.prisma.systemConfig.upsert({
      where: { key },
      create: { key, value, group, secret, updatedBy },
      update: { value, group, secret, updatedBy },
    });
  }

  async getSmtpPublic(): Promise<SmtpPublicConfig> {
    const map = await this.getConfigMap();
    const host = map.get(MAIL_CONFIG_KEYS.host) || '';
    const port = Number(map.get(MAIL_CONFIG_KEYS.port) || 587);
    const username = map.get(MAIL_CONFIG_KEYS.username) || '';
    const passwordEnc = map.get(MAIL_CONFIG_KEYS.password) || '';
    const encryption = (map.get(MAIL_CONFIG_KEYS.encryption) || 'starttls') as MailEncryption;
    const fromEmail = map.get(MAIL_CONFIG_KEYS.fromEmail) || '';
    const fromName = map.get(MAIL_CONFIG_KEYS.fromName) || 'ZRH AI';
    const replyTo = map.get(MAIL_CONFIG_KEYS.replyTo) || '';
    const connectionTimeoutMs = Number(map.get(MAIL_CONFIG_KEYS.timeoutMs) || 15000);
    const passwordConfigured = !!passwordEnc;
    const configured = !!(host && fromEmail && port > 0);
    return {
      host,
      port,
      username,
      password: passwordConfigured ? PASSWORD_PLACEHOLDER : '',
      passwordConfigured,
      encryption,
      fromEmail,
      fromName,
      replyTo,
      connectionTimeoutMs,
      configured,
    };
  }

  async getCodePolicy(): Promise<CodePolicy> {
    const map = await this.getConfigMap();
    return {
      length: Number(map.get(MAIL_CONFIG_KEYS.codeLength) || 6),
      ttlSeconds: Number(map.get(MAIL_CONFIG_KEYS.codeTtlSeconds) || 600),
      intervalSeconds: Number(map.get(MAIL_CONFIG_KEYS.codeIntervalSeconds) || 60),
      dailyLimit: Number(map.get(MAIL_CONFIG_KEYS.codeDailyLimit) || 20),
      maxRetries: Number(map.get(MAIL_CONFIG_KEYS.codeMaxRetries) || 3),
    };
  }

  async saveSmtp(
    input: {
      host: string;
      port: number;
      username?: string;
      password?: string;
      encryption: string;
      fromEmail: string;
      fromName?: string;
      replyTo?: string;
      connectionTimeoutMs?: number;
    },
    updatedBy?: number,
  ) {
    const enc = input.encryption as MailEncryption;
    if (!['none', 'ssl', 'tls', 'starttls'].includes(enc)) {
      throw new BadRequestException('invalid encryption');
    }
    await this.upsertConfig(MAIL_CONFIG_KEYS.host, input.host.trim(), 'smtp', false, updatedBy);
    await this.upsertConfig(MAIL_CONFIG_KEYS.port, String(input.port), 'smtp', false, updatedBy);
    await this.upsertConfig(
      MAIL_CONFIG_KEYS.username,
      (input.username || '').trim(),
      'smtp',
      false,
      updatedBy,
    );
    await this.upsertConfig(MAIL_CONFIG_KEYS.encryption, enc, 'smtp', false, updatedBy);
    await this.upsertConfig(
      MAIL_CONFIG_KEYS.fromEmail,
      input.fromEmail.trim().toLowerCase(),
      'smtp',
      false,
      updatedBy,
    );
    await this.upsertConfig(
      MAIL_CONFIG_KEYS.fromName,
      (input.fromName || 'ZRH AI').trim(),
      'smtp',
      false,
      updatedBy,
    );
    await this.upsertConfig(
      MAIL_CONFIG_KEYS.replyTo,
      (input.replyTo || '').trim().toLowerCase(),
      'smtp',
      false,
      updatedBy,
    );
    await this.upsertConfig(
      MAIL_CONFIG_KEYS.timeoutMs,
      String(input.connectionTimeoutMs ?? 15000),
      'smtp',
      false,
      updatedBy,
    );

    const pwd = input.password ?? '';
    if (pwd && pwd !== PASSWORD_PLACEHOLDER) {
      if (!process.env.MAIL_CONFIG_CRYPTO_KEY) {
        throw new BadRequestException('MAIL_CONFIG_CRYPTO_KEY is required to store SMTP password');
      }
      const cipher = encryptSecret(pwd);
      await this.upsertConfig(MAIL_CONFIG_KEYS.password, cipher, 'smtp', true, updatedBy);
    }

    return this.getSmtpPublic();
  }

  async saveCodePolicy(policy: CodePolicy, updatedBy?: number) {
    await this.upsertConfig(MAIL_CONFIG_KEYS.codeLength, String(policy.length), 'mail', false, updatedBy);
    await this.upsertConfig(
      MAIL_CONFIG_KEYS.codeTtlSeconds,
      String(policy.ttlSeconds),
      'mail',
      false,
      updatedBy,
    );
    await this.upsertConfig(
      MAIL_CONFIG_KEYS.codeIntervalSeconds,
      String(policy.intervalSeconds),
      'mail',
      false,
      updatedBy,
    );
    await this.upsertConfig(
      MAIL_CONFIG_KEYS.codeDailyLimit,
      String(policy.dailyLimit),
      'mail',
      false,
      updatedBy,
    );
    await this.upsertConfig(
      MAIL_CONFIG_KEYS.codeMaxRetries,
      String(policy.maxRetries),
      'mail',
      false,
      updatedBy,
    );
    return this.getCodePolicy();
  }

  private async resolveSmtpRuntime(): Promise<{
    host: string;
    port: number;
    username: string;
    password: string;
    encryption: MailEncryption;
    fromEmail: string;
    fromName: string;
    replyTo: string;
    connectionTimeoutMs: number;
  } | null> {
    const pub = await this.getSmtpPublic();
    if (!pub.configured) return null;
    const map = await this.getConfigMap();
    const encPwd = map.get(MAIL_CONFIG_KEYS.password) || '';
    let password = '';
    if (encPwd) {
      if (!isEncryptedSecret(encPwd)) {
        throw new ServiceUnavailableException('SMTP password storage is invalid; re-save password');
      }
      password = decryptSecret(encPwd);
    }
    return {
      host: pub.host,
      port: pub.port,
      username: pub.username,
      password,
      encryption: pub.encryption,
      fromEmail: pub.fromEmail,
      fromName: pub.fromName,
      replyTo: pub.replyTo,
      connectionTimeoutMs: pub.connectionTimeoutMs,
    };
  }

  private buildTransport(smtp: NonNullable<Awaited<ReturnType<MailService['resolveSmtpRuntime']>>>) {
    const secure = smtp.encryption === 'ssl' || smtp.encryption === 'tls';
    const requireTLS = smtp.encryption === 'starttls';
    return nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure,
      requireTLS,
      auth: smtp.username ? { user: smtp.username, pass: smtp.password } : undefined,
      connectionTimeout: smtp.connectionTimeoutMs,
      greetingTimeout: smtp.connectionTimeoutMs,
      socketTimeout: smtp.connectionTimeoutMs,
    });
  }

  renderTemplate(body: string, vars: Record<string, string>): string {
    return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) =>
      vars[key] != null ? String(vars[key]) : '',
    );
  }

  async listTemplates() {
    const items = await this.prisma.mailTemplate.findMany({
      orderBy: [{ type: 'asc' }, { locale: 'asc' }],
    });
    return { items, types: MAIL_TEMPLATE_TYPES, locales: MAIL_LOCALES };
  }

  async upsertTemplate(
    input: {
      type: string;
      locale: string;
      subject: string;
      htmlBody: string;
      textBody: string;
      variables?: string;
      enabled?: boolean;
    },
    updatedBy?: number,
  ) {
    if (!(MAIL_TEMPLATE_TYPES as readonly string[]).includes(input.type)) {
      throw new BadRequestException('invalid template type');
    }
    if (!(MAIL_LOCALES as readonly string[]).includes(input.locale)) {
      throw new BadRequestException('invalid locale');
    }
    const existing = await this.prisma.mailTemplate.findUnique({
      where: { type_locale: { type: input.type, locale: input.locale } },
    });
    const row = await this.prisma.mailTemplate.upsert({
      where: { type_locale: { type: input.type, locale: input.locale } },
      create: {
        type: input.type,
        locale: input.locale,
        subject: input.subject,
        htmlBody: input.htmlBody,
        textBody: input.textBody,
        variables: input.variables || '[]',
        enabled: input.enabled ?? true,
        version: 1,
        updatedBy,
      },
      update: {
        subject: input.subject,
        htmlBody: input.htmlBody,
        textBody: input.textBody,
        variables: input.variables ?? existing?.variables ?? '[]',
        enabled: input.enabled ?? existing?.enabled ?? true,
        version: (existing?.version || 1) + 1,
        updatedBy,
      },
    });
    return row;
  }

  async listSendLogs(opts?: { take?: number; skip?: number; status?: string; templateType?: string }) {
    const take = Math.min(opts?.take ?? 50, 200);
    const skip = opts?.skip ?? 0;
    const where: { status?: string; templateType?: string } = {};
    if (opts?.status) where.status = opts.status;
    if (opts?.templateType) where.templateType = opts.templateType;
    const [items, total] = await Promise.all([
      this.prisma.mailSendLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.mailSendLog.count({ where }),
    ]);
    return { items, total, take, skip };
  }

  /**
   * When SMTP is missing:
   * - production → hard error (never fake success / never devCode)
   * - non-prod + MAIL_DEV_CODE_ENABLED=true → allow caller to use log+devCode
   * - otherwise → hard error
   */
  async ensureDeliveryMode(): Promise<'smtp' | 'dev'> {
    const smtp = await this.resolveSmtpRuntime();
    if (smtp) return 'smtp';
    // Explicit switch only (test/dev). Production must keep MAIL_DEV_CODE_ENABLED=false.
    if (this.isDevCodeEnabled()) return 'dev';
    throw new ServiceUnavailableException('邮件服务尚未配置');
  }

  async sendTemplated(input: {
    to: string;
    templateType: MailTemplateType | string;
    locale?: MailLocale | string;
    vars?: Record<string, string>;
    userId?: number;
    requestIp?: string;
    /** If true, allow soft fail for anti-enumeration (forgot password) */
    softFail?: boolean;
  }): Promise<SendMailResult> {
    const to = input.to.trim().toLowerCase();
    const locale = (input.locale || 'zh-CN') as string;
    const templateType = input.templateType;
    const vars = { ...(input.vars || {}), appName: input.vars?.appName || 'ZRH AI' };

    const mode = await this.ensureDeliveryMode().catch((err) => {
      if (input.softFail) return null;
      throw err;
    });
    if (mode === null) {
      await this.prisma.mailSendLog.create({
        data: {
          toMasked: maskEmail(to),
          templateType,
          status: 'failed',
          provider: 'none',
          attempts: 0,
          errorCode: 'SMTP_NOT_CONFIGURED',
          errorMessage: '邮件服务尚未配置',
          userId: input.userId,
          requestIp: input.requestIp,
          completedAt: new Date(),
        },
      });
      return { mode: 'dev', reason: 'smtp_not_configured_soft' };
    }
    if (mode === 'dev') {
      await this.prisma.mailSendLog.create({
        data: {
          toMasked: maskEmail(to),
          templateType,
          status: 'sent',
          provider: 'dev',
          attempts: 1,
          errorCode: 'DEV_FALLBACK',
          errorMessage: 'dev fallback (MAIL_DEV_CODE_ENABLED); not delivered via SMTP',
          userId: input.userId,
          requestIp: input.requestIp,
          completedAt: new Date(),
        },
      });
      return { mode: 'dev', reason: 'MAIL_DEV_CODE_ENABLED' };
    }

    const smtp = await this.resolveSmtpRuntime();
    if (!smtp) throw new ServiceUnavailableException('邮件服务尚未配置');

    let template = await this.prisma.mailTemplate.findFirst({
      where: { type: templateType, locale, enabled: true },
    });
    if (!template) {
      template = await this.prisma.mailTemplate.findFirst({
        where: { type: templateType, locale: 'zh-CN', enabled: true },
      });
    }
    if (!template) {
      throw new BadRequestException(`mail template not found: ${templateType}/${locale}`);
    }

    const subject = this.renderTemplate(template.subject, vars);
    const html = this.renderTemplate(template.htmlBody, vars);
    const text = this.renderTemplate(template.textBody, vars);

    const log = await this.prisma.mailSendLog.create({
      data: {
        toMasked: maskEmail(to),
        templateType,
        status: 'sending',
        provider: 'smtp',
        attempts: 1,
        userId: input.userId,
        requestIp: input.requestIp,
      },
    });

    const policy = await this.getCodePolicy();
    let lastErr: unknown;
    for (let attempt = 1; attempt <= Math.max(1, policy.maxRetries + 1); attempt++) {
      try {
        const transport = this.buildTransport(smtp);
        const info = await transport.sendMail({
          from: smtp.fromName ? `"${smtp.fromName}" <${smtp.fromEmail}>` : smtp.fromEmail,
          to,
          replyTo: smtp.replyTo || undefined,
          subject,
          html,
          text,
        });
        await this.prisma.mailSendLog.update({
          where: { id: log.id },
          data: {
            status: 'sent',
            messageId: info.messageId || null,
            attempts: attempt,
            completedAt: new Date(),
            errorCode: null,
            errorMessage: null,
          },
        });
        return { mode: 'sent', messageId: info.messageId, logId: log.id };
      } catch (err) {
        lastErr = err;
        await this.prisma.mailSendLog.update({
          where: { id: log.id },
          data: {
            status: 'failed',
            attempts: attempt,
            errorCode: 'SMTP_SEND_FAILED',
            errorMessage: sanitizeErrorMessage(err),
            completedAt: new Date(),
          },
        });
      }
    }

    if (input.softFail) {
      return { mode: 'dev', reason: 'smtp_send_failed_soft' };
    }
    this.logger.warn(`SMTP send failed to=${maskEmail(to)} type=${templateType}`);
    throw new ServiceUnavailableException(
      `邮件发送失败: ${sanitizeErrorMessage(lastErr)}`,
    );
  }

  async testConnection(updatedBy?: number) {
    const smtp = await this.resolveSmtpRuntime();
    if (!smtp) throw new ServiceUnavailableException('邮件服务尚未配置');
    const transport = this.buildTransport(smtp);
    try {
      await transport.verify();
      return { ok: true, message: 'SMTP connection verified', updatedBy };
    } catch (err) {
      throw new BadRequestException(`SMTP verify failed: ${sanitizeErrorMessage(err)}`);
    }
  }

  async testSend(to: string, templateType?: string, locale?: string, userId?: number, requestIp?: string) {
    return this.sendTemplated({
      to,
      templateType: templateType || 'system_notice',
      locale: locale || 'zh-CN',
      vars: {
        code: '000000',
        ttlMinutes: '10',
        appName: 'ZRH AI',
        message: 'This is a Mail Center test message.',
      },
      userId,
      requestIp,
    });
  }

  /** Enforce interval + daily limit for verification email targets */
  async assertCodeRateLimits(target: string) {
    const policy = await this.getCodePolicy();
    const email = target.toLowerCase();
    const sinceInterval = new Date(Date.now() - policy.intervalSeconds * 1000);
    const recent = await this.prisma.verificationCode.findFirst({
      where: { target: email, channel: 'email', createdAt: { gt: sinceInterval } },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      throw new BadRequestException(`请稍后再试（间隔 ${policy.intervalSeconds} 秒）`);
    }
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayCount = await this.prisma.verificationCode.count({
      where: { target: email, channel: 'email', createdAt: { gte: dayStart } },
    });
    if (dayCount >= policy.dailyLimit) {
      throw new BadRequestException('今日验证码发送次数已达上限');
    }
    return policy;
  }

  generateCode(length: number): string {
    const len = Math.min(10, Math.max(4, length));
    let out = '';
    for (let i = 0; i < len; i++) {
      out += String(Math.floor(Math.random() * 10));
    }
    return out;
  }

  purposeToTemplate(purpose: string): MailTemplateType {
    if (purpose === 'register') return 'register_code';
    if (purpose === 'login') return 'login_code';
    if (purpose === 'reset' || purpose === 'forgot') return 'forgot_password';
    if (purpose === 'bind' || purpose === 'change_email') return 'change_email';
    return 'register_code';
  }

  statusSummary() {
    return {
      production: this.isProduction(),
      mailDevCodeEnabled: this.isDevCodeEnabled(),
      cryptoKeyConfigured: !!process.env.MAIL_CONFIG_CRYPTO_KEY,
    };
  }
}
