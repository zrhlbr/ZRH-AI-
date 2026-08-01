import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemService } from '../system/system.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly system: SystemService,
  ) {}

  async dashboard() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [usersToday, usersTotal, onlineSessions, announcements] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: start } } }),
      this.prisma.user.count(),
      this.prisma.userSession.count({
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
      }),
      this.prisma.systemAnnouncement.count({ where: { published: true } }),
    ]);

    const [cpu, memory, gpu, docker] = await Promise.all([
      this.system.cpu(),
      this.system.memory(),
      this.system.gpu(),
      this.system.docker(),
    ]);

    return {
      users: { today: usersToday, total: usersTotal, onlineSessions },
      ai: {
        requestsToday: 0, // 预留：后续接 AI 调用计量
        tokensToday: 0,
        note: 'AI request/token counters reserved for metering phase',
      },
      infra: { cpu, memory, gpu, docker },
      modules: {
        knowledge: true,
        workflow: true,
        agent: true,
        mcp: true,
        business: true,
      },
      announcements,
      generatedAt: new Date().toISOString(),
    };
  }

  async listUsers(q?: string) {
    const items = await this.prisma.user.findMany({
      where: q
        ? {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
              { displayName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: { role: true, profile: true },
      orderBy: { id: 'asc' },
      take: 200,
    });
    return {
      items: items.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        email: u.email,
        phone: u.phone,
        status: u.status,
        role: u.role.code,
        roleName: u.role.name,
        nickname: u.profile?.nickname,
        createdAt: u.createdAt,
      })),
    };
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      include: { _count: { select: { users: true, permissions: true } } },
      orderBy: { id: 'asc' },
    });
    return {
      items: roles.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        users: r._count.users,
        permissions: r._count.permissions,
      })),
    };
  }

  async listPermissions() {
    const items = await this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
    return { items };
  }

  async listAnnouncements() {
    const items = await this.prisma.systemAnnouncement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { items };
  }

  async upsertAnnouncement(input: {
    id?: number;
    title: string;
    body: string;
    locale?: string;
    published?: boolean;
    createdBy?: number;
  }) {
    if (input.id) {
      return this.prisma.systemAnnouncement.update({
        where: { id: input.id },
        data: {
          title: input.title,
          body: input.body,
          locale: input.locale || 'zh-CN',
          published: !!input.published,
          publishedAt: input.published ? new Date() : null,
        },
      });
    }
    return this.prisma.systemAnnouncement.create({
      data: {
        title: input.title,
        body: input.body,
        locale: input.locale || 'zh-CN',
        published: !!input.published,
        publishedAt: input.published ? new Date() : null,
        createdBy: input.createdBy,
      },
    });
  }

  async setUserStatus(userId: number, status: 'active' | 'disabled') {
    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, username: true, status: true },
    });
  }

  async setUserRole(userId: number, roleCode: string) {
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) throw new BadRequestException(`role ${roleCode} not found`);
    return this.prisma.user.update({
      where: { id: userId },
      data: { roleId: role.id },
      include: { role: true },
    });
  }
}
