import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AIGatewayService } from '../../ai/gateway/ai-gateway.service';
import { AIMessage } from '../../ai/types/ai.types';
import { RagEngineService } from '../../rag/engine/rag-engine.service';
import { AgentRegistryService } from '../registry/agent-registry.service';
import { AgentRouterService } from '../router/agent-router.service';
import { AgentMemoryService } from '../memory/agent-memory.service';
import { AgentSkillsService } from '../skills/agent-skills.service';
import { AgentChatResult, AgentProfileView } from '../types/agent.types';

/**
 * Agent Runtime：统一执行 / 调度 / 上下文 / 权限 / 日志。
 * 通过 AI Gateway 与 RAG Engine 调用，不修改 Gateway。
 */
@Injectable()
export class AgentRuntimeService {
  private readonly logger = new Logger(AgentRuntimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AIGatewayService,
    private readonly rag: RagEngineService,
    private readonly registry: AgentRegistryService,
    private readonly router: AgentRouterService,
    private readonly memory: AgentMemoryService,
    private readonly skills: AgentSkillsService,
  ) {}

  private async assertRoleAccess(agent: AgentProfileView, userId: number) {
    if (!agent.enabled || agent.status !== 'active') {
      throw new ForbiddenException('agent is disabled');
    }
    if (!agent.roleAccess) return;
    let allowed: string[] = [];
    try {
      allowed = JSON.parse(agent.roleAccess) as string[];
    } catch {
      allowed = agent.roleAccess.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (!allowed.length) return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    const roleCode = user?.role?.code ?? 'USER';
    if (roleCode === 'SUPER_ADMIN') return;
    if (!allowed.includes(roleCode)) {
      throw new ForbiddenException('role cannot use this agent');
    }
  }

  private pickSkill(skillCodes: string[], message: string): string {
    const t = message.toLowerCase();
    if (skillCodes.includes('rag') && /(知识|文档|knowledge|rag|policy|手册)/i.test(t)) return 'rag';
    if (skillCodes.includes('knowledge_search') && /(搜索|检索|search|find doc)/i.test(t)) return 'knowledge_search';
    if (skillCodes.includes('translate') && /(翻译|translate|缅文|burmese)/i.test(t)) return 'translate';
    if (skillCodes.includes('code') && /(code|bug|函数|typescript|python|报错)/i.test(t)) return 'code';
    if (skillCodes.includes('summarize') && /(总结|摘要|summarize)/i.test(t)) return 'summarize';
    if (skillCodes.includes('chat')) return 'chat';
    return skillCodes[0] ?? 'chat';
  }

  private async log(input: {
    agentId: number;
    userId: number;
    skillCode: string;
    inputSummary: string;
    status: string;
    latencyMs: number;
    error?: string;
  }) {
    await this.prisma.agentRunLog.create({
      data: {
        agentId: input.agentId,
        userId: input.userId,
        skillCode: input.skillCode,
        inputSummary: input.inputSummary.slice(0, 500),
        status: input.status,
        latencyMs: input.latencyMs,
        error: input.error?.slice(0, 1000),
      },
    });
  }

  async chat(input: {
    userId: number;
    message: string;
    agentCode?: string;
    conversationId?: number;
    modelRef?: string;
  }): Promise<AgentChatResult> {
    const started = Date.now();
    const routed = await this.router.route(input.message, input.agentCode);
    const agent = routed.agent;
    await this.assertRoleAccess(agent, input.userId);

    const skillCodes = await this.skills.getEnabledCodes(agent.id);
    const skillUsed = this.pickSkill(skillCodes, input.message);
    this.logger.log(`runtime agent=${agent.code} skill=${skillUsed} reason=${routed.reason}`);

    try {
      if ((skillUsed === 'rag' || skillUsed === 'knowledge_search') && skillCodes.includes('rag')) {
        const ragResult = await this.rag.ask({
          userId: input.userId,
          query: input.message,
          conversationId: input.conversationId,
          modelRef: input.modelRef ?? agent.defaultModel ?? undefined,
          mode: 'hybrid',
        });
        await this.memory.create(agent.code, input.userId, {
          kind: 'conversation',
          content: `Q: ${input.message}\nA: ${ragResult.answer.slice(0, 1000)}`,
          conversationId: ragResult.conversationId,
        });
        const latencyMs = Date.now() - started;
        await this.log({
          agentId: agent.id,
          userId: input.userId,
          skillCode: skillUsed,
          inputSummary: input.message,
          status: 'success',
          latencyMs,
        });
        return {
          agentCode: agent.code,
          agentName: agent.name,
          answer: ragResult.answer,
          skillUsed,
          conversationId: ragResult.conversationId,
          citations: ragResult.citations,
          relatedDocuments: ragResult.relatedDocuments,
          metrics: ragResult.metrics as unknown as Record<string, unknown>,
          latencyMs,
        };
      }

      const memoryText = await this.memory.loadContext(agent.id, input.userId);
      const messages: AIMessage[] = [
        { role: 'system', content: agent.systemPrompt },
      ];
      if (memoryText) {
        messages.push({ role: 'system', content: `Agent long-term memory:\n${memoryText}` });
      }
      if (skillUsed === 'translate') {
        messages.push({
          role: 'system',
          content: 'Focus on high-quality translation among zh-CN / my-MM / en-US. Preserve meaning and formatting.',
        });
      }
      if (skillUsed === 'code') {
        messages.push({
          role: 'system',
          content: 'Focus on correct code, root-cause analysis and minimal safe fixes.',
        });
      }
      if (skillUsed === 'summarize') {
        messages.push({
          role: 'system',
          content: 'Produce a clear structured summary with bullet points when helpful.',
        });
      }
      messages.push({ role: 'user', content: input.message });

      const answer = await this.gateway.generate(
        messages,
        input.modelRef ?? agent.defaultModel ?? undefined,
      );

      await this.memory.create(agent.code, input.userId, {
        kind: 'conversation',
        content: `Q: ${input.message}\nA: ${answer.slice(0, 1000)}`,
        conversationId: input.conversationId,
      });

      const latencyMs = Date.now() - started;
      await this.log({
        agentId: agent.id,
        userId: input.userId,
        skillCode: skillUsed,
        inputSummary: input.message,
        status: 'success',
        latencyMs,
      });

      return {
        agentCode: agent.code,
        agentName: agent.name,
        answer,
        skillUsed,
        conversationId: input.conversationId,
        latencyMs,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.log({
        agentId: agent.id,
        userId: input.userId,
        skillCode: skillUsed,
        inputSummary: input.message,
        status: 'error',
        latencyMs: Date.now() - started,
        error: message,
      });
      throw error;
    }
  }
}
