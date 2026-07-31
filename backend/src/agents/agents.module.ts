import { Module } from '@nestjs/common';
import { AIModule } from '../ai/ai.module';
import { RagModule } from '../rag/rag.module';
import { AgentsController } from './agents.controller';
import { AgentRegistryService } from './registry/agent-registry.service';
import { AgentSkillsService } from './skills/agent-skills.service';
import { AgentMemoryService } from './memory/agent-memory.service';
import { AgentRouterService } from './router/agent-router.service';
import { AgentRuntimeService } from './runtime/agent-runtime.service';
import { AgentLogsService } from './logs/agent-logs.service';
import { AgentHealthService } from './health/agent-health.service';

/**
 * Stage 7 Agent Center。
 * 统一管理企业 AI 员工；通过 AI Gateway / RAG Engine 执行，不修改 Gateway。
 */
@Module({
  imports: [AIModule, RagModule],
  controllers: [AgentsController],
  providers: [
    AgentRegistryService,
    AgentSkillsService,
    AgentMemoryService,
    AgentRouterService,
    AgentRuntimeService,
    AgentLogsService,
    AgentHealthService,
  ],
  exports: [AgentRegistryService, AgentRuntimeService],
})
export class AgentsModule {}
