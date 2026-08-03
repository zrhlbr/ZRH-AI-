import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * 从 POSTGRES_* 环境变量构造 DATABASE_URL。
 * 容器内使用服务名 + 内部端口；本地开发使用 localhost + 映射端口。
 */
export function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    // Stabilization R2: ensure pool knobs when caller omitted them
    const raw = process.env.DATABASE_URL;
    if (raw.includes('connection_limit=') || raw.includes('pool_timeout=')) return raw;
    const sep = raw.includes('?') ? '&' : '?';
    const limit = process.env.PRISMA_CONNECTION_LIMIT ?? '10';
    const pool = process.env.PRISMA_POOL_TIMEOUT ?? '10';
    return `${raw}${sep}connection_limit=${limit}&pool_timeout=${pool}`;
  }
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const port = process.env.POSTGRES_PORT ?? '5432';
  const db = process.env.POSTGRES_DB ?? 'zrh_ai';
  const user = process.env.POSTGRES_USER ?? 'zrh_ai';
  const password = encodeURIComponent(process.env.POSTGRES_PASSWORD ?? '');
  const limit = process.env.PRISMA_CONNECTION_LIMIT ?? '10';
  const pool = process.env.PRISMA_POOL_TIMEOUT ?? '10';
  return `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public&connection_limit=${limit}&pool_timeout=${pool}`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ datasources: { db: { url: buildDatabaseUrl() } } });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('PostgreSQL connected');
    } catch (error) {
      // 数据库不可用时不让进程崩溃，健康检查会报告 offline。
      this.logger.warn(`PostgreSQL connect failed at boot: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** 轻量探活：SELECT 1，带超时。 */
  async ping(timeoutMs = 3000): Promise<boolean> {
    try {
      const probe = this.$queryRaw`SELECT 1`;
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('db ping timeout')), timeoutMs),
      );
      await Promise.race([probe, timeout]);
      return true;
    } catch {
      return false;
    }
  }
}
