import { Injectable } from '@nestjs/common';
import { OllamaEmbeddingProvider } from '../../knowledge/embedding/ollama-embedding.provider';
import { VectorRegistryService } from '../vector/vector-registry.service';
import { RagRetrieverService } from '../retriever/rag-retriever.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RagHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: OllamaEmbeddingProvider,
    private readonly vectors: VectorRegistryService,
    private readonly retriever: RagRetrieverService,
  ) {}

  async status() {
    const [embeddingHealth, vectorHealth, synonymCount, pendingTasks] = await Promise.all([
      this.embedding.health(),
      this.vectors.getActive().health(),
      this.prisma.ragSynonym.count({ where: { enabled: true } }),
      this.prisma.embeddingTask.count({ where: { status: 'pending' } }),
    ]);

    let retrieverOk = true;
    let retrieverError: string | undefined;
    try {
      await this.retriever.retrieve({
        userId: 0,
        query: 'health',
        mode: 'keyword',
        topK: 1,
      });
    } catch (error) {
      // userId 0 无文档属正常；仅捕获意外异常
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('permission') && !message.includes('not found')) {
        retrieverOk = false;
        retrieverError = message;
      }
    }

    return {
      embedding: {
        ok: embeddingHealth.status === 'online',
        provider: this.embedding.code,
        latencyMs: embeddingHealth.latencyMs,
        error: embeddingHealth.error,
      },
      vector: {
        ok: vectorHealth.status === 'online',
        provider: this.vectors.getActive().code,
        count: vectorHealth.count,
        providers: this.vectors.list(),
        error: vectorHealth.error,
      },
      retriever: {
        ok: retrieverOk,
        error: retrieverError,
      },
      synonyms: synonymCount,
      pendingEmbeddingTasks: pendingTasks,
    };
  }
}
