import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AIGatewayService } from '../ai/gateway/ai-gateway.service';

export interface HealthReport {
  service: string;
  version: string;
  status: 'ok' | 'degraded';
  timestamp: string;
  database: 'online' | 'offline';
  redis: 'online' | 'offline';
  ollama: 'online' | 'offline';
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gateway: AIGatewayService,
  ) {}

  async check(): Promise<HealthReport> {
    const [dbOk, redisOk, ollamaHealth] = await Promise.all([
      this.prisma.ping(),
      this.redis.ping(),
      this.gateway.checkProvider('ollama').catch(() => ({ status: 'offline' as const })),
    ]);

    const allOk = dbOk && redisOk && ollamaHealth.status === 'online';

    return {
      service: 'zrh-ai-api',
      version: '0.1.0',
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbOk ? 'online' : 'offline',
      redis: redisOk ? 'online' : 'offline',
      ollama: ollamaHealth.status === 'online' ? 'online' : 'offline',
    };
  }
}
