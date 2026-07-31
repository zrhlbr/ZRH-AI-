import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AgentRuntimeService } from '../../agents/runtime/agent-runtime.service';
import { ToolRuntimeService } from '../../tools/runtime/tool-runtime.service';
import { McpGatewayService } from '../../mcp/gateway/mcp-gateway.service';
import { McpRegistryService } from '../../mcp/registry/mcp-registry.service';
import { WorkflowVariablesService } from '../variables/workflow-variables.service';
import { WorkflowNode } from '../types/workflow.types';

type VarCtx = ReturnType<WorkflowVariablesService['createContext']>;

/**
 * Workflow Nodes 执行器。
 * Agent / Tool / MCP 必须走对应平台；禁止直连外部系统。
 */
@Injectable()
export class WorkflowNodesService {
  private readonly logger = new Logger(WorkflowNodesService.name);

  constructor(
    private readonly agents: AgentRuntimeService,
    private readonly tools: ToolRuntimeService,
    private readonly mcpGateway: McpGatewayService,
    private readonly mcpRegistry: McpRegistryService,
    private readonly vars: WorkflowVariablesService,
  ) {}

  async executeNode(input: {
    node: WorkflowNode;
    userId: number;
    roleCode: string;
    ctx: VarCtx;
  }): Promise<{ output: unknown; nextHint?: string; waitApproval?: boolean }> {
    const { node, userId, roleCode, ctx } = input;
    const cfg = (node.config ?? {}) as Record<string, unknown>;

    switch (node.type) {
      case 'start':
        return { output: { started: true } };
      case 'end':
        return { output: { finished: true } };
      case 'agent':
        return this.runAgent(cfg, userId, ctx);
      case 'tool':
        return this.runTool(cfg, userId, roleCode, ctx);
      case 'mcp':
        return this.runMcp(cfg, userId, roleCode, ctx);
      case 'condition':
        return this.runCondition(cfg, ctx);
      case 'switch':
        return this.runSwitch(cfg, ctx);
      case 'loop':
        return this.runLoopMeta(cfg, ctx);
      case 'delay':
        return this.runDelay(cfg);
      case 'merge':
        return { output: { merged: true } };
      case 'approval':
        return { output: { waiting: true, message: cfg.message ?? 'approval required' }, waitApproval: true };
      case 'webhook':
        return {
          output: {
            reserved: true,
            message: 'Webhook node reserved — no external call in Stage 9',
          },
        };
      default:
        throw new BadRequestException(`unsupported node type: ${node.type}`);
    }
  }

  private async runAgent(cfg: Record<string, unknown>, userId: number, ctx: VarCtx) {
    const agentCode = String(cfg.agentCode ?? 'assistant');
    const message = String(
      this.vars.resolveValue(cfg.message ?? '{{input.message}}', ctx) ?? '',
    );
    const result = await this.agents.chat({
      userId,
      message: message || 'hello',
      agentCode,
    });
    this.vars.setVar(ctx, 'lastAgentCode', result.agentCode);
    this.vars.setVar(ctx, 'lastAnswer', result.answer);
    this.vars.setVar(ctx, 'lastOk', true);
    return { output: result };
  }

  private async runTool(
    cfg: Record<string, unknown>,
    userId: number,
    roleCode: string,
    ctx: VarCtx,
  ) {
    const toolCode = String(cfg.toolCode ?? '');
    if (!toolCode) throw new BadRequestException('tool node missing toolCode');
    const rawArgs = (cfg.args as Record<string, unknown>) ?? {};
    const args = this.vars.resolveValue(rawArgs, ctx) as Record<string, unknown>;
    const result = await this.tools.execute({
      toolCode,
      userId,
      roleCode,
      args,
      mode: 'sync',
      agentCode: 'workflow',
    });
    const ok = result.status === 'success';
    this.vars.setVar(ctx, 'lastToolCode', toolCode);
    this.vars.setVar(ctx, 'lastToolStatus', result.status);
    this.vars.setVar(ctx, 'lastOk', ok);
    if (toolCode === 'system_health' && result.output && typeof result.output === 'object') {
      this.vars.setVar(ctx, 'lastOk', Boolean((result.output as { ok?: boolean }).ok));
    }
    if (!ok) {
      throw new BadRequestException(result.error ?? `tool failed: ${toolCode}`);
    }
    return { output: result };
  }

  private async runMcp(
    cfg: Record<string, unknown>,
    userId: number,
    roleCode: string,
    ctx: VarCtx,
  ) {
    const serverCode = String(cfg.serverCode ?? '');
    if (!serverCode) throw new BadRequestException('mcp node missing serverCode');
    if (cfg.autoEnable) {
      const server = await this.mcpRegistry.getRawByCode(serverCode);
      if (!server.enabled) {
        await this.mcpRegistry.setEnabled(serverCode, true);
      }
    }
    const action = String(cfg.action ?? 'invoke');
    const payload = (this.vars.resolveValue(cfg.payload ?? {}, ctx) as Record<string, unknown>) ?? {};

    // 统一经 MCP Gateway：先 connect stub，再 invoke stub
    const session = await this.mcpGateway.connect({
      serverCode,
      userId,
      roleCode,
      metadata: { from: 'workflow', action },
    });
    const invoked = await this.mcpGateway.invokeStub(serverCode, action, payload);
    try {
      await this.mcpGateway.disconnect({ userId, sessionId: session.id });
    } catch (err) {
      this.logger.warn(`mcp disconnect: ${err instanceof Error ? err.message : String(err)}`);
    }
    this.vars.setVar(ctx, 'lastMcpServer', serverCode);
    this.vars.setVar(ctx, 'lastOk', true);
    return { output: { session, invoked } };
  }

  private runCondition(cfg: Record<string, unknown>, ctx: VarCtx) {
    const expression = String(cfg.expression ?? 'true');
    const ok = this.vars.evaluateCondition(expression, ctx);
    const trueTo = cfg.trueTo ? String(cfg.trueTo) : undefined;
    const falseTo = cfg.falseTo ? String(cfg.falseTo) : undefined;
    return {
      output: { expression, result: ok },
      nextHint: ok ? trueTo : falseTo,
    };
  }

  private runSwitch(cfg: Record<string, unknown>, ctx: VarCtx) {
    const value = this.vars.resolveValue(cfg.value ?? '{{vars.lastToolStatus}}', ctx);
    const cases = (cfg.cases as Record<string, string>) ?? {};
    const next = cases[String(value)] ?? (cfg.defaultTo ? String(cfg.defaultTo) : undefined);
    return { output: { value, next }, nextHint: next };
  }

  private runLoopMeta(cfg: Record<string, unknown>, ctx: VarCtx) {
    const max = Math.min(20, Math.max(1, Number(cfg.maxIterations ?? 3)));
    const key = String(cfg.counterKey ?? 'loopCount');
    const current = Number(ctx.vars[key] ?? 0) + 1;
    this.vars.setVar(ctx, key, current);
    const continueLoop = current < max;
    return {
      output: { iteration: current, max, continueLoop },
      nextHint: continueLoop ? String(cfg.bodyTo ?? '') : String(cfg.exitTo ?? ''),
    };
  }

  private async runDelay(cfg: Record<string, unknown>) {
    const ms = Math.min(10000, Math.max(0, Number(cfg.ms ?? 200)));
    await new Promise((r) => setTimeout(r, ms));
    return { output: { delayedMs: ms } };
  }
}
