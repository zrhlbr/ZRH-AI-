import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemService } from '../system/system.service';

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly system: SystemService,
  ) {}

  assertSuper(role: string) {
    if (role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('SUPER_ADMIN only');
    }
  }

  async overview() {
    const [configs, docker, cpu, memory, storage] = await Promise.all([
      this.prisma.systemConfig.findMany({ orderBy: { group: 'asc' } }),
      this.system.docker(),
      this.system.cpu(),
      this.system.memory(),
      this.system.storage(),
    ]);
    return {
      configs: configs.map((c) => ({
        key: c.key,
        group: c.group,
        secret: c.secret,
        value: c.secret ? '***' : c.value,
        updatedAt: c.updatedAt,
      })),
      infra: { docker, cpu, memory, storage },
      reserved: {
        backup: true,
        restore: true,
        upgrade: true,
        cloudflare: true,
        smtp: false,
        oauth: true,
        license: true,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async listConfigs() {
    const items = await this.prisma.systemConfig.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });
    return {
      items: items.map((c) => ({
        id: c.id,
        key: c.key,
        group: c.group,
        secret: c.secret,
        value: c.secret ? '***' : c.value,
        updatedAt: c.updatedAt,
      })),
    };
  }

  async upsertConfig(input: {
    key: string;
    value: string;
    group?: string;
    secret?: boolean;
    updatedBy?: number;
  }) {
    return this.prisma.systemConfig.upsert({
      where: { key: input.key },
      create: {
        key: input.key,
        value: input.value,
        group: input.group || 'general',
        secret: !!input.secret,
        updatedBy: input.updatedBy,
      },
      update: {
        value: input.value,
        group: input.group,
        secret: input.secret,
        updatedBy: input.updatedBy,
      },
    });
  }

  async systemLogsReserved() {
    return {
      ok: true,
      reserved: true,
      items: [],
      message: 'centralized system log store reserved; use docker logs / journal for now',
    };
  }

  async backupRestoreReserved() {
    return {
      backup: { reserved: true, message: 'database backup job reserved' },
      restore: { reserved: true, message: 'database restore job reserved' },
      upgrade: { reserved: true, message: 'platform upgrade orchestrator reserved' },
    };
  }

  async integrationsReserved() {
    return {
      cloudflare: { reserved: true },
      smtp: { reserved: false, module: 'mail-center-v1' },
      oauth: { reserved: true },
      aiProvider: { reserved: true },
      license: { reserved: true },
    };
  }
}
