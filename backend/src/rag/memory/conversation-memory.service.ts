import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Conversation Memory：同一会话多轮问答，结合 Chat 消息历史与 Knowledge。
 */
@Injectable()
export class ConversationMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async loadRecent(userId: number, conversationId: number | undefined, limit = 8) {
    if (!conversationId) return [];
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    });
    if (!conv) throw new NotFoundException('conversation not found');

    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        role: { in: ['user', 'assistant'] },
      },
      orderBy: { id: 'desc' },
      take: limit,
      select: { role: true, content: true },
    });

    return rows
      .reverse()
      .map((r) => ({
        role: r.role as 'user' | 'assistant',
        content: r.content.slice(0, 1200),
      }));
  }

  async persistTurn(input: {
    userId: number;
    conversationId?: number;
    model: string;
    question: string;
    answer: string;
  }): Promise<number> {
    let conversationId = input.conversationId;
    if (!conversationId) {
      const created = await this.prisma.conversation.create({
        data: {
          userId: input.userId,
          title: input.question.slice(0, 40) || 'RAG Chat',
          model: input.model,
          lastMessageAt: new Date(),
        },
      });
      conversationId = created.id;
    } else {
      const owned = await this.prisma.conversation.findFirst({
        where: { id: conversationId, userId: input.userId },
      });
      if (!owned) throw new NotFoundException('conversation not found');
    }

    await this.prisma.message.createMany({
      data: [
        {
          conversationId,
          role: 'user',
          content: input.question,
          model: input.model,
        },
        {
          conversationId,
          role: 'assistant',
          content: input.answer,
          model: input.model,
        },
      ],
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });
    return conversationId;
  }
}
