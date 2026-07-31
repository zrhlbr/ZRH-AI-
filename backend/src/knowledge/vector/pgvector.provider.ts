import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IVectorProvider,
  VectorRecord,
  VectorSearchResult,
  VectorProviderHealth,
} from '../interfaces/vector-provider.interface';

/**
 * PostgreSQL JSONB Vector Provider（阶段 5 基础实现）。
 * 使用 knowledge_vectors 表存储 embedding，应用层计算余弦相似度。
 * 后续可切换为 pgvector 原生 vector 类型与索引。
 */
@Injectable()
export class PgvectorProvider implements IVectorProvider {
  readonly code = 'pgvector';

  constructor(private readonly prisma: PrismaService) {}

  async initialize(dimension: number): Promise<void> {
    // JSONB 表已随迁移创建，维度仅作校验/记录
    await this.prisma.$executeRawUnsafe(`COMMENT ON TABLE "knowledge_vectors" IS 'dimension=${dimension}'`);
  }

  async insert(records: VectorRecord[]): Promise<void> {
    if (records.length === 0) return;
    const values = records
      .map((r) => `(${r.chunkId}, '${JSON.stringify(r.embedding)}'::jsonb)`)
      .join(',');
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "knowledge_vectors" ("chunk_id", "embedding") VALUES ${values}
       ON CONFLICT ("chunk_id") DO UPDATE SET "embedding" = EXCLUDED."embedding", "createdAt" = CURRENT_TIMESTAMP`,
    );
  }

  async delete(chunkIds: number[]): Promise<void> {
    if (chunkIds.length === 0) return;
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "knowledge_vectors" WHERE "chunk_id" IN (${chunkIds.join(',')})`,
    );
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async search(embedding: number[], topK: number): Promise<VectorSearchResult[]> {
    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT "chunk_id", "embedding" FROM "knowledge_vectors"`,
    )) as Array<{ chunk_id: number; embedding: number[] }>;

    const scored = rows.map((r) => ({
      chunkId: r.chunk_id,
      score: this.cosineSimilarity(embedding, r.embedding),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  async rebuild(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "knowledge_vectors"`);
  }

  async health(): Promise<VectorProviderHealth> {
    try {
      await this.prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "knowledge_vectors"`);
      return { status: 'online' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 'error', error: message };
    }
  }
}
