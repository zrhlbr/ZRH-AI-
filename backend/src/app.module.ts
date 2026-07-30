import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { OllamaModule } from './ollama/ollama.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [PrismaModule, RedisModule, OllamaModule, HealthModule],
})
export class AppModule {}
