import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

const ACCESS_TTL_SECONDS = 30 * 60; // 30 分钟
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(userId: number, username: string, role: string, meta: { ip?: string; userAgent?: string }): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, username, role, type: 'access' },
      { expiresIn: ACCESS_TTL_SECONDS },
    );

    const refreshToken = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return {
      accessToken,
      accessTokenExpiresIn: ACCESS_TTL_SECONDS,
      refreshToken,
      refreshTokenExpiresAt: expiresAt.toISOString(),
    };
  }

  async login(username: string, password: string, meta: { ip?: string; userAgent?: string }): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { role: true },
    });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('invalid username or password');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      this.logger.warn(`login failed for ${username}`);
      throw new UnauthorizedException('invalid username or password');
    }
    this.logger.log(`login success: ${username} (${user.role.code})`);
    return this.issueTokens(user.id, user.username, user.role.code, meta);
  }

  /** Refresh Token 轮换：验证旧 token → 吊销 → 签发新对 */
  async refresh(refreshToken: string, meta: { ip?: string; userAgent?: string }): Promise<TokenPair> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(refreshToken) },
      include: { user: { include: { role: true } } },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('invalid or expired refresh token');
    }
    if (stored.user.status !== 'active') {
      throw new UnauthorizedException('user not available');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.user.id, stored.user.username, stored.user.role.code, meta);
  }

  async logout(refreshToken: string): Promise<{ revoked: boolean }> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: result.count > 0 };
  }

  async profile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!user) throw new UnauthorizedException('user not found');
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role.code,
      roleName: user.role.name,
      permissions: user.role.permissions.map((rp) => rp.permission.code),
      createdAt: user.createdAt.toISOString(),
    };
  }
}
