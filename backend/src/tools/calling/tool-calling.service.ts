import { Injectable, Logger } from '@nestjs/common';
import { AIGatewayService } from '../../ai/gateway/ai-gateway.service';
import { ToolRouterService } from '../router/tool-router.service';
import { ToolRuntimeService } from '../runtime/tool-runtime.service';
import { ToolRegistryService } from '../registry/tool-registry.service';
import { ToolExecuteResult } from '../types/tool.types';

/**
 * Tool Calling：LLM 辅助参数生成 + Runtime 执行。
 * 不修改 AI Gateway；仅通过 generate 接口。
 */
@Injectable()
export class ToolCallingService {
  private readonly logger = new Logger(ToolCallingService.name);

  constructor(
    private readonly gateway: AIGatewayService,
    private readonly router: ToolRouterService,
    private readonly runtime: ToolRuntimeService,
    private readonly registry: ToolRegistryService,
  ) {}

  private extractJson(text: string): Record<string, unknown> | null {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async call(input: {
    userId: number;
    roleCode: string;
    message: string;
    agentCode?: string;
    toolCode?: string;
    args?: Record<string, unknown>;
  }): Promise<{
    plan: { toolCode: string; args: Record<string, unknown>; reason: string };
    result: ToolExecuteResult;
    llmAssisted: boolean;
  }> {
    let toolCode = input.toolCode;
    let args = input.args;
    let reason = 'explicit';
    let llmAssisted = false;

    if (!toolCode) {
      const routed = await this.router.route({
        task: input.message,
        agentCode: input.agentCode,
      });
      toolCode = routed.plan.toolCode;
      args = args ?? routed.plan.args;
      reason = routed.plan.reason;
    }

    const tool = await this.registry.getByCode(toolCode);

    if (!args || Object.keys(args).length === 0) {
      try {
        const prompt = [
          {
            role: 'system' as const,
            content:
              'You generate JSON arguments for a tool. Reply with ONLY a JSON object matching the schema. No markdown.',
          },
          {
            role: 'user' as const,
            content: `Tool: ${tool.code}\nSchema: ${JSON.stringify(tool.inputSchema)}\nUser request: ${input.message}\nJSON args:`,
          },
        ];
        const raw = await this.gateway.generate(prompt);
        const parsed = this.extractJson(raw);
        if (parsed) {
          args = parsed;
          llmAssisted = true;
          reason = `${reason}+llm_args`;
        }
      } catch (err) {
        this.logger.warn(
          `llm arg generation failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (!args) {
      const routed = await this.router.route({
        task: input.message,
        agentCode: input.agentCode,
      });
      args = routed.plan.args;
      reason = `${reason}+router_args`;
    }

    const result = await this.runtime.execute({
      toolCode,
      userId: input.userId,
      roleCode: input.roleCode,
      args,
      agentCode: input.agentCode,
      mode: 'sync',
    });

    return {
      plan: { toolCode, args, reason },
      result,
      llmAssisted,
    };
  }
}
