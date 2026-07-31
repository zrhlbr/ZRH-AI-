import { Module } from '@nestjs/common';
import { AIModule } from '../ai/ai.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [AIModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
