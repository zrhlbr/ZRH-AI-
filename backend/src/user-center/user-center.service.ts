import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserCenterService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        profile: true,
      },
    });
    if (!user) throw new NotFoundException('user not found');
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone,
      emailVerifiedAt: user.emailVerifiedAt,
      phoneVerifiedAt: user.phoneVerifiedAt,
      role: user.role.code,
      roleName: user.role.name,
      profile: user.profile ?? {
        nickname: user.displayName,
        avatarUrl: null,
        country: null,
        language: 'zh-CN',
        bio: null,
        timezone: null,
      },
      createdAt: user.createdAt,
    };
  }

  async updateProfile(
    userId: number,
    data: {
      displayName?: string;
      nickname?: string;
      avatarUrl?: string;
      country?: string;
      language?: string;
      bio?: string;
      timezone?: string;
    },
  ) {
    if (data.displayName) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { displayName: data.displayName },
      });
    }
    await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        nickname: data.nickname,
        avatarUrl: data.avatarUrl,
        country: data.country,
        language: data.language || 'zh-CN',
        bio: data.bio,
        timezone: data.timezone,
      },
      update: {
        nickname: data.nickname,
        avatarUrl: data.avatarUrl,
        country: data.country,
        language: data.language,
        bio: data.bio,
        timezone: data.timezone,
      },
    });
    return this.getMe(userId);
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('user not found');
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('current password incorrect');
    if (newPassword.length < 8) throw new BadRequestException('password too short');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async loginHistory(userId: number, take = 50) {
    const items = await this.prisma.userLoginLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 200),
    });
    return { items };
  }

  async devices(userId: number) {
    const items = await this.prisma.userDevice.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
    });
    return { items };
  }

  async revokeDevice(userId: number, deviceId: string) {
    await this.prisma.userDevice.updateMany({
      where: { userId, deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async sessions(userId: number) {
    const items = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: 'desc' },
      take: 50,
    });
    return { items };
  }

  async notifications(userId: number) {
    const items = await this.prisma.userNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { items };
  }

  /** API Token 预留 */
  apiTokensReserved() {
    return {
      ok: true,
      reserved: true,
      items: [],
      message: 'API Token management reserved for later phase',
    };
  }
}
