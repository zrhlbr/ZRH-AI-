export const MAIL_CONFIG_KEYS = {
  host: 'mail.smtp.host',
  port: 'mail.smtp.port',
  username: 'mail.smtp.username',
  password: 'mail.smtp.password',
  encryption: 'mail.smtp.encryption',
  fromEmail: 'mail.smtp.fromEmail',
  fromName: 'mail.smtp.fromName',
  replyTo: 'mail.smtp.replyTo',
  timeoutMs: 'mail.smtp.connectionTimeoutMs',
  codeLength: 'mail.code.length',
  codeTtlSeconds: 'mail.code.ttlSeconds',
  codeIntervalSeconds: 'mail.code.intervalSeconds',
  codeDailyLimit: 'mail.code.dailyLimit',
  codeMaxRetries: 'mail.code.maxRetries',
} as const;

export type MailEncryption = 'none' | 'ssl' | 'tls' | 'starttls';

export const MAIL_TEMPLATE_TYPES = [
  'register_code',
  'login_code',
  'forgot_password',
  'change_email',
  'invite_user',
  'invite_employee',
  'org_invite',
  'system_notice',
  'welcome',
] as const;

export type MailTemplateType = (typeof MAIL_TEMPLATE_TYPES)[number];

export const MAIL_LOCALES = ['zh-CN', 'en-US', 'my-MM'] as const;
export type MailLocale = (typeof MAIL_LOCALES)[number];

export const PASSWORD_PLACEHOLDER = '********';
