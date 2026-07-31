import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(PgvectorProvider.name);
  private dimension = 768;

  constructor(private readonly prisma: PrismaService) {}

  async initialize(dimension: number): Promise<void> {
    this.dimension = dimension > 0 ? dimension : this.dimension;
    await this.prisma.$executeRawUnsafe(
      `COMMENT ON TABLE "knowledge_vectors" IS 'dimension=${this.dimension}'`,
    );
  }

  private assertVector(embedding: number[]): void {
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('embedding vector is empty');
    }
    if (this.dimension > 0 && embedding.length !== this.dimension) {
      this.logger.warn(`embedding dim ${embedding.length} != expected ${this.dimension}`);
    }
    for (const v of embedding) {
      if (typeof v !== 'number' || Number.isNaN(v)) {
        throw new Error('embedding contains non-numeric values');
      }
    }
  }

  async insert(records: VectorRecord[]): Promise<void> {
    if (records.length === 0) return;
    for (const r of records) {
      this.assertVector(r.embedding);
      const payload = JSON.stringify(r.embedding);
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "knowledge_vectors" ("chunk_id", "embedding")
         VALUES ($1, $2::jsonb)
         ON CONFLICT ("chunk_id") DO UPDATE
         SET "embedding" = EXCLUDED."embedding", "createdAt" = CURRENT_TIMESTAMP`,
        r.chunkId,
        payload,
      );
    }
  }

  async delete(chunkIds: number[]): Promise<void> {
    if (chunkIds.length === 0) return;
    const ids = chunkIds.filter((id) => Number.isInteger(id) && id > 0);
    if (ids.length === 0) return;
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "knowledge_vectors" WHERE "chunk_id" = ANY($1::int[])`,
      ids,
    );
  }

  private parseEmbedding(raw: unknown): number[] | null {
    let value: unknown = raw;
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        return null;
      }
    }
    if (!Array.isArray(value) || value.length === 0) return null;
    if (!value.every((v) => typeof v === 'number' && !Number.isNaN(v))) return null;
    return value as number[];
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    if (len === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async search(embedding: number[], topK: number): Promise<VectorSearchResult[]> {
    this.assertVector(embedding);
    const k = Math.max(1, Math.min(topK || 10, 100));
    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT "chunk_id", "embedding" FROM "knowledge_vectors"`,
    )) as Array<{ chunk_id: number; embedding: unknown }>;

    const scored: VectorSearchResult[] = [];
    for (const r of rows) {
      const vector = this.parseEmbedding(r.embedding);
      if (!vector) continue;
      scored.push({
        chunkId: Number(r.chunk_id),
        score: this.cosineSimilarity(embedding, vector),
      });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }

  async rebuild(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "knowledge_vectors"`);
  }

  async health(): Promise<VectorProviderHealth> {
    try {
      const rows = (await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS count FROM "knowledge_vectors"`,
      )) as Array<{ count: number }>;
      const count = Number(rows[0]?.count ?? 0);
      return { status: 'online', count };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 'error', error: message };
    }
  }
}
