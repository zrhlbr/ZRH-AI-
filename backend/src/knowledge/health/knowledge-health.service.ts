import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OllamaEmbeddingProvider } from '../embedding/ollama-embedding.provider';
import { PgvectorProvider } from '../vector/pgvector.provider';

@Injectable()
export class KnowledgeHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: OllamaEmbeddingProvider,
    private readonly vector: PgvectorProvider,
  ) {}

  async status() {
    const [documentCount, chunkCount, vectorCount, embeddingHealth, vectorHealth] = await Promise.all([
      this.prisma.knowledgeDocument.count({ where: { isDeleted: false } }),
      this.prisma.knowledgeChunk.count(),
      this.prisma.$queryRawUnsafe<{ count: number }[]>(`SELECT COUNT(*) as count FROM "knowledge_vectors"`),
      this.embedding.health(),
      this.vector.health(),
    ]);
    const vectors = Number((vectorCount as { count: number }[])[0]?.count ?? 0);
    return {
      documents: documentCount,
      chunks: chunkCount,
      vectors,
      parser: { ok: true, supportedFormats: ['txt', 'md', 'html', 'json', 'xml', 'csv', 'pdf', 'docx', 'xlsx', 'zip'] },
      embedding: {
        ok: embeddingHealth.status === 'online',
        provider: this.embedding.code,
        latencyMs: embeddingHealth.latencyMs,
        error: embeddingHealth.error,
      },
      vector: {
        ok: vectorHealth.status === 'online',
        provider: this.vector.code,
        count: vectorHealth.count ?? vectors,
        error: vectorHealth.error,
      },
    };
  }
}
