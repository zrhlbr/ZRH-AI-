import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { ToolsModule } from '../tools/tools.module';
import { McpModule } from '../mcp/mcp.module';
import { WorkflowsController } from './workflows.controller';
import { WorkflowRegistryService } from './registry/workflow-registry.service';
import { WorkflowVariablesService } from './variables/workflow-variables.service';
import { WorkflowNodesService } from './nodes/workflow-nodes.service';
import { WorkflowRuntimeService } from './runtime/workflow-runtime.service';
import { WorkflowSchedulerService } from './scheduler/workflow-scheduler.service';
import { WorkflowHistoryService } from './history/workflow-history.service';
import { WorkflowHealthService } from './health/workflow-health.service';

/**
 * Stage 9 Workflow Engine。
 * 架构：Workflow → Agent Center → Tool Manager → MCP Gateway → External。
 * 禁止 Workflow 直连外部系统；不修改 AI Gateway。
 */
@Module({
  imports: [AgentsModule, ToolsModule, McpModule],
  controllers: [WorkflowsController],
  providers: [
    WorkflowRegistryService,
    WorkflowVariablesService,
    WorkflowNodesService,
    WorkflowRuntimeService,
    WorkflowSchedulerService,
    WorkflowHistoryService,
    WorkflowHealthService,
  ],
  exports: [WorkflowRegistryService, WorkflowRuntimeService],
})
export class WorkflowsModule {}
