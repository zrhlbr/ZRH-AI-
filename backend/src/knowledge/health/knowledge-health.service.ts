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
    return {
      documents: documentCount,
      chunks: chunkCount,
      vectors: Number((vectorCount as { count: number }[])[0]?.count ?? 0),
      embedding: embeddingHealth,
      vector: vectorHealth,
    };
  }
}
