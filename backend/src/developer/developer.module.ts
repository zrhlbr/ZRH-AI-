import { Module } from '@nestjs/common';
import { AIModule } from '../ai/ai.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { DeveloperController } from './developer.controller';
import { SecurityPolicyService } from './security-policy.service';
import { RunnerClientService } from './runner-client.service';
import { DevAuditService } from './audit.service';
import { WorkspaceService } from './workspace.service';
import { CodeIndexService } from './code-index.service';
import { PlanService } from './plan.service';
import { DiffService } from './diff.service';
import { TerminalService } from './terminal.service';
import { GitWriteService } from './git-write.service';
import { DevSkillsService } from './skills.service';
import { DeveloperOrchestrator } from './orchestrator.service';

@Module({
  imports: [AIModule, KnowledgeModule],
  controllers: [DeveloperController],
  providers: [
    SecurityPolicyService,
    RunnerClientService,
    DevAuditService,
    WorkspaceService,
    CodeIndexService,
    PlanService,
    DiffService,
    TerminalService,
    GitWriteService,
    DevSkillsService,
    DeveloperOrchestrator,
  ],
  exports: [RunnerClientService, WorkspaceService, DeveloperOrchestrator],
})
export class DeveloperModule {}
