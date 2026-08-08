import { Module } from '@nestjs/common';
import { SystemModule } from '../system/system.module';
import { AIModule } from '../ai/ai.module';
import { SuperAdminController } from './superadmin.controller';
import { AiInfraController } from './ai-infra.controller';
import { SuperAdminService } from './superadmin.service';

@Module({
  imports: [SystemModule, AIModule],
  controllers: [SuperAdminController, AiInfraController],
  providers: [SuperAdminService],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
