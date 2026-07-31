import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentRegistryService } from '../registry/agent-registry.service';

/**
 * Agent Memory：长期记忆，统一挂接 conversation / knowledge / note。
 */
@Injectable()
export class AgentMemoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AgentRegistryService,
  ) {}

  async list(agentCode: string, userId: number, limit = 50) {
    const agent = await this.registry.getByCode(agentCode);
    return this.prisma.agentMemory.findMany({
      where: { agentId: agent.id, userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }

  async create(
    agentCode: string,
    userId: number,
    data: { content: string; kind?: string; key?: string; conversationId?: number },
  ) {
    const agent = await this.registry.getByCode(agentCode);
    return this.prisma.agentMemory.create({
      data: {
        agentId: agent.id,
        userId,
        content: data.content,
        kind: data.kind ?? 'note',
        key: data.key,
        conversationId: data.conversationId,
      },
    });
  }

  async remove(id: number, userId: number) {
    const row = await this.prisma.agentMemory.findUnique({ where: { id } });
    if (!row || row.userId !== userId) throw new NotFoundException('memory not found');
    await this.prisma.agentMemory.delete({ where: { id } });
    return { deleted: true };
  }

  /** 供 Runtime 注入的近期记忆文本 */
  async loadContext(agentId: number, userId: number, limit = 6): Promise<string> {
    const rows = await this.prisma.agentMemory.findMany({
      where: { agentId, userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    if (!rows.length) return '';
    return rows
      .reverse()
      .map((r) => `[${r.kind}${r.key ? `:${r.key}` : ''}] ${r.content.slice(0, 500)}`)
      .join('\n');
  }
}
