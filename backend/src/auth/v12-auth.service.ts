import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import {
  ForgotPasswordDto,
  RegisterDto,
  ResetPasswordDto,
  SendCodeDto,
  V12LoginDto,
} from './dto/v12-auth.dto';

const ACCESS_TTL_SECONDS = 30 * 60;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REMEMBER_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class V12AuthService {
  private readonly logger = new Logger(V12AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private async issueTokens(
    userId: number,
    username: string,
    role: string,
    meta: { ip?: string; userAgent?: string; rememberMe?: boolean; deviceId?: string; deviceName?: string },
  ) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, username, role, type: 'access' },
      { expiresIn: ACCESS_TTL_SECONDS },
    );
    const refreshTtl = meta.rememberMe ? REMEMBER_REFRESH_TTL_MS : REFRESH_TTL_MS;
    const refreshToken = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + refreshTtl);
    const tokenHash = this.hash(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    await this.prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash: tokenHash,
        ip: meta.ip,
        userAgent: meta.userAgent,
        rememberMe: !!meta.rememberMe,
        expiresAt,
      },
    });

    if (meta.deviceId) {
      await this.prisma.userDevice.upsert({
        where: { userId_deviceId: { userId, deviceId: meta.deviceId } },
        create: {
          userId,
          deviceId: meta.deviceId,
          name: meta.deviceName,
          userAgent: meta.userAgent,
          lastIp: meta.ip,
        },
        update: {
          name: meta.deviceName,
          userAgent: meta.userAgent,
          lastIp: meta.ip,
          lastSeenAt: new Date(),
          revokedAt: null,
        },
      });
    }

    return {
      accessToken,
      accessTokenExpiresIn: ACCESS_TTL_SECONDS,
      refreshToken,
      refreshTokenExpiresAt: expiresAt.toISOString(),
    };
  }

  async sendCode(dto: SendCodeDto) {
    if (dto.channel === 'phone') {
      // 预留：短信通道尚未接入，仅返回占位协议
      return {
        ok: true,
        channel: 'phone',
        reserved: true,
        message: 'phone verification channel reserved; not delivered in P1',
        expiresInSeconds: 600,
      };
    }

    const code = String(randomInt(100000, 999999));
    await this.prisma.verificationCode.create({
      data: {
        target: dto.target.toLowerCase(),
        channel: dto.channel,
        purpose: dto.purpose,
        codeHash: this.hash(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    // P1：开发/私有化环境将验证码写入日志（生产应走 SMTP）
    this.logger.log(`[email-code] target=${dto.target} purpose=${dto.purpose} code=${code}`);

    return {
      ok: true,
      channel: 'email',
      reserved: false,
      message: 'verification code issued (check server logs / SMTP in later phase)',
      expiresInSeconds: 600,
      // 仅非生产便于联调
      devCode: process.env.NODE_ENV === 'production' ? undefined : code,
    };
  }

  private async consumeCode(target: string, channel: string, purpose: string, code?: string) {
    if (!code) throw new BadRequestException('verification code required');
    const row = await this.prisma.verificationCode.findFirst({
      where: {
        target: target.toLowerCase(),
        channel,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!row || row.codeHash !== this.hash(code)) {
      throw new BadRequestException('invalid or expired verification code');
    }
    await this.prisma.verificationCode.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
  }

  async register(dto: RegisterDto, meta: { ip?: string; userAgent?: string }) {
    if (!dto.acceptTerms || !dto.acceptPrivacy) {
      throw new BadRequestException('terms and privacy must be accepted');
    }
    if (!dto.username && !dto.email && !dto.phone) {
      throw new BadRequestException('username, email or phone is required');
    }
    if (dto.email) {
      await this.consumeCode(dto.email, 'email', 'register', dto.emailCode);
    }
    if (dto.phone && dto.phoneCode) {
      // 预留通道：若传入 code 则校验；无 SMTP/SMS 时允许仅手机号+预留
      await this.consumeCode(dto.phone, 'phone', 'register', dto.phoneCode);
    }

    let roleCode = 'USER';
    if (dto.inviteCode) {
      const invite = await this.prisma.inviteCode.findUnique({ where: { code: dto.inviteCode } });
      if (!invite || !invite.enabled || (invite.expiresAt && invite.expiresAt < new Date())) {
        throw new BadRequestException('invalid invite code');
      }
      if (invite.usedCount >= invite.maxUses) {
        throw new BadRequestException('invite code exhausted');
      }
      roleCode = invite.roleCode;
      await this.prisma.inviteCode.update({
        where: { id: invite.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) throw new BadRequestException(`role ${roleCode} not found`);

    const username =
      dto.username?.trim() ||
      (dto.email ? dto.email.split('@')[0].slice(0, 24) : undefined) ||
      `u${Date.now().toString().slice(-8)}`;

    const exists = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username },
          ...(dto.email ? [{ email: dto.email.toLowerCase() }] : []),
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
      },
    });
    if (exists) throw new ConflictException('account already exists');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username,
        displayName: dto.displayName?.trim() || username,
        passwordHash,
        email: dto.email?.toLowerCase(),
        phone: dto.phone,
        emailVerifiedAt: dto.email ? new Date() : null,
        phoneVerifiedAt: dto.phone && dto.phoneCode ? new Date() : null,
        roleId: role.id,
        profile: {
          create: {
            nickname: dto.displayName?.trim() || username,
            language: dto.language || 'zh-CN',
          },
        },
      },
      include: { role: true },
    });

    const tokens = await this.issueTokens(user.id, user.username, user.role.code, meta);
    await this.prisma.userLoginLog.create({
      data: {
        userId: user.id,
        method: dto.email ? 'email' : dto.phone ? 'phone' : 'username',
        success: true,
        ip: meta.ip,
        userAgent: meta.userAgent,
        detail: 'register',
      },
    });

    return {
      user: { id: user.id, username: user.username, role: user.role.code },
      ...tokens,
    };
  }

  async loginV12(dto: V12LoginDto, meta: { ip?: string; userAgent?: string }) {
    const account = dto.account.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: account },
          { email: account.toLowerCase() },
          { phone: account },
        ],
      },
      include: { role: true },
    });

    const fail = async (detail: string) => {
      if (user) {
        await this.prisma.userLoginLog.create({
          data: {
            userId: user.id,
            method: account.includes('@') ? 'email' : /^\+?\d{6,}$/.test(account) ? 'phone' : 'username',
            success: false,
            ip: meta.ip,
            userAgent: meta.userAgent,
            detail,
          },
        });
      }
      throw new UnauthorizedException('invalid account or password');
    };

    if (!user || user.status !== 'active') await fail('user missing/disabled');
    const ok = await bcrypt.compare(dto.password, user!.passwordHash);
    if (!ok) await fail('bad password');

    const method = user!.email === account.toLowerCase() ? 'email' : user!.phone === account ? 'phone' : 'username';
    await this.prisma.userLoginLog.create({
      data: {
        userId: user!.id,
        method,
        success: true,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return this.issueTokens(user!.id, user!.username, user!.role.code, {
      ...meta,
      rememberMe: dto.rememberMe,
      deviceId: dto.deviceId,
      deviceName: dto.deviceName,
    });
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const account = dto.account.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: account }, { email: account.toLowerCase() }, { phone: account }],
      },
    });
    // 防枚举：始终返回 ok
    if (!user) {
      return { ok: true, message: 'if the account exists, a reset token was issued' };
    }

    const channel =
      dto.channel ||
      (user.email ? 'email' : user.phone ? 'phone' : 'email');
    if (channel === 'phone' && !user.phone) {
      return { ok: true, message: 'if the account exists, a reset token was issued', reserved: true };
    }

    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(token),
        channel,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    if (channel === 'email') {
      this.logger.log(`[reset-token] user=${user.username} token=${token}`);
    }

    return {
      ok: true,
      channel,
      reserved: channel === 'phone',
      message: 'if the account exists, a reset token was issued',
      devToken: process.env.NODE_ENV === 'production' ? undefined : token,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hash(dto.token) },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('invalid or expired reset token');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.userSession.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  async adminResetPassword(adminId: number, userId: number, newPassword: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      include: { role: true },
    });
    if (!admin || !['SUPER_ADMIN', 'ADMIN'].includes(admin.role.code)) {
      throw new UnauthorizedException('admin required');
    }
    if (admin.role.code === 'ADMIN') {
      // ADMIN 不可重置 SUPER_ADMIN
      const target = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
      });
      if (!target) throw new BadRequestException('user not found');
      if (target.role.code === 'SUPER_ADMIN') {
        throw new UnauthorizedException('cannot reset SUPER_ADMIN password');
      }
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
}
