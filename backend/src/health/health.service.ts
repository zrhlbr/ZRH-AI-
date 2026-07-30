import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { OllamaService } from '../ollama/ollama.service';

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
    private readonly ollama: OllamaService,
  ) {}

  async check(): Promise<HealthReport> {
    const [dbOk, redisOk, ollamaStatus] = await Promise.all([
      this.prisma.ping(),
      this.redis.ping(),
      this.ollama.getStatus(),
    ]);

    const allOk = dbOk && redisOk && ollamaStatus.status === 'online';

    return {
      service: 'zrh-ai-api',
      version: '0.1.0',
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbOk ? 'online' : 'offline',
      redis: redisOk ? 'online' : 'offline',
      ollama: ollamaStatus.status,
    };
  }
}
