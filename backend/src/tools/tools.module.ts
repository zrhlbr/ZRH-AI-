import { Module } from '@nestjs/common';
import { AIModule } from '../ai/ai.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { RagModule } from '../rag/rag.module';
import { ToolsController } from './tools.controller';
import { ToolRegistryService } from './registry/tool-registry.service';
import { ToolRuntimeService } from './runtime/tool-runtime.service';
import { BuiltinExecutorsService } from './runtime/builtin-executors.service';
import { ToolCallingService } from './calling/tool-calling.service';
import { ToolRouterService } from './router/tool-router.service';
import { ToolLogsService } from './logs/tool-logs.service';
import { ToolHealthService } from './health/tool-health.service';

/**
 * Stage 8 Tool Calling Platform。
 * 统一 Tool Registry / Runtime / Calling / Router；不修改 AI Gateway。
 */
@Module({
  imports: [AIModule, KnowledgeModule, RagModule],
  controllers: [ToolsController],
  providers: [
    ToolRegistryService,
    BuiltinExecutorsService,
    ToolRuntimeService,
    ToolCallingService,
    ToolRouterService,
    ToolLogsService,
    ToolHealthService,
  ],
  exports: [ToolRegistryService, ToolRuntimeService, ToolCallingService],
})
export class ToolsModule {}
