import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskStatus } from '../types/knowledge.types';

/**
 * Embedding Task Service：管理文档向量化任务状态。
 */
@Injectable()
export class EmbeddingTaskService {
  constructor(private readonly prisma: PrismaService) {}

  async create(documentId: number, providerCode: string) {
    return this.prisma.embeddingTask.create({
      data: { documentId, providerCode, status: 'pending' },
    });
  }

  async start(id: number) {
    return this.prisma.embeddingTask.update({
      where: { id },
      data: { status: 'running', startedAt: new Date() },
    });
  }

  async complete(id: number) {
    return this.prisma.embeddingTask.update({
      where: { id },
      data: { status: 'completed', completedAt: new Date() },
    });
  }

  async fail(id: number, error: string) {
    return this.prisma.embeddingTask.update({
      where: { id },
      data: { status: 'failed', completedAt: new Date(), error: error.slice(0, 1000) },
    });
  }

  async listByDocument(documentId: number) {
    return this.prisma.embeddingTask.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPending(limit = 10) {
    return this.prisma.embeddingTask.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Stabilization R2: reclaim stuck running tasks, then atomically claim pending rows.
   */
  async claimPending(limit = 10): Promise<Array<{ id: number; documentId: number; providerCode: string }>> {
    const staleMs = Number(process.env.EMBEDDING_TASK_STALE_MS ?? String(15 * 60 * 1000));
    const cutoff = new Date(Date.now() - (Number.isFinite(staleMs) ? staleMs : 15 * 60 * 1000));
    await this.prisma.embeddingTask.updateMany({
      where: { status: 'running', startedAt: { lt: cutoff } },
      data: { status: 'pending', startedAt: null, error: 'stale running reset' },
    });

    const pending = await this.prisma.embeddingTask.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true, documentId: true, providerCode: true },
    });

    const claimed: Array<{ id: number; documentId: number; providerCode: string }> = [];
    for (const row of pending) {
      const result = await this.prisma.embeddingTask.updateMany({
        where: { id: row.id, status: 'pending' },
        data: { status: 'running', startedAt: new Date() },
      });
      if (result.count === 1) claimed.push(row);
    }
    return claimed;
  }
}
