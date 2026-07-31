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
}
