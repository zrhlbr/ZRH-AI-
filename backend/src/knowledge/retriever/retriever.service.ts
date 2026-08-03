import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OllamaEmbeddingProvider } from '../embedding/ollama-embedding.provider';
import { PgvectorProvider } from '../vector/pgvector.provider';
import { KnowledgePermissionService } from '../permissions/permission.service';
import { keywordOverlapScore } from '../utils/text-tokenize';

export interface SearchResult {
  chunkId: number;
  documentId: number;
  title: string;
  filename: string;
  content: string;
  score: number;
  source: 'semantic' | 'keyword' | 'hybrid';
}

export interface SearchOptions {
  query: string;
  mode?: 'keyword' | 'semantic' | 'hybrid';
  topK?: number;
  userId?: number;
  filters?: { documentIds?: number[]; language?: string };
}

export interface SearchResponse {
  query: string;
  mode: 'keyword' | 'semantic' | 'hybrid';
  topK: number;
  results: SearchResult[];
}

/**
 * Retriever：支持 Keyword / Semantic / Hybrid 检索。
 * 检索范围受 Knowledge 权限过滤约束。
 */
@Injectable()
export class RetrieverService {
  private readonly logger = new Logger(RetrieverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: OllamaEmbeddingProvider,
    private readonly vector: PgvectorProvider,
    private readonly permissions: KnowledgePermissionService,
  ) {}

  private async resolveAllowedDocumentIds(
    userId: number | undefined,
    explicitIds?: number[],
  ): Promise<number[] | undefined> {
    if (userId === undefined) {
      return explicitIds?.length ? explicitIds : undefined;
    }
    const filter = await this.permissions.buildDocumentFilter(userId);
    const docs = await this.prisma.knowledgeDocument.findMany({
      where: filter,
      select: { id: true },
      take: 5000,
    });
    const allowed = docs.map((d) => d.id);
    // Stabilization R2: never trust explicitIds alone — intersect with ACL
    if (explicitIds?.length) {
      const set = new Set(explicitIds);
      return allowed.filter((id) => set.has(id));
    }
    return allowed;
  }

  private async attachDocumentMeta(
    scored: Array<{ chunkId: number; documentId: number; content: string; score: number; source: SearchResult['source'] }>,
  ): Promise<SearchResult[]> {
    const docIds = [...new Set(scored.map((s) => s.documentId))];
    const docs = await this.prisma.knowledgeDocument.findMany({
      where: { id: { in: docIds } },
      select: { id: true, title: true, filename: true },
    });
    const meta = new Map(docs.map((d) => [d.id, d]));
    return scored.map((s) => {
      const doc = meta.get(s.documentId);
      return {
        chunkId: s.chunkId,
        documentId: s.documentId,
        title: doc?.title ?? '',
        filename: doc?.filename ?? '',
        content: s.content,
        score: s.score,
        source: s.source,
      };
    });
  }

  private async keywordSearch(
    query: string,
    topK: number,
    filters?: SearchOptions['filters'],
  ): Promise<SearchResult[]> {
    if (filters?.documentIds && filters.documentIds.length === 0) return [];

    const where: Prisma.KnowledgeChunkWhereInput = {};
    if (filters?.documentIds) {
      where.documentId = { in: filters.documentIds };
    }
    if (filters?.language) {
      where.language = filters.language;
    }
    const q = query.trim().slice(0, 100);
    if (q.length >= 2) {
      where.content = { contains: q, mode: 'insensitive' };
    }

    const chunks = await this.prisma.knowledgeChunk.findMany({
      where,
      select: { id: true, documentId: true, content: true },
      take: 300,
      orderBy: { id: 'desc' },
    });

    // Fallback: if contains prefilter empty, sample within ACL docs
    let candidates = chunks;
    if (candidates.length === 0 && filters?.documentIds?.length) {
      candidates = await this.prisma.knowledgeChunk.findMany({
        where: {
          documentId: { in: filters.documentIds },
          ...(filters.language ? { language: filters.language } : {}),
        },
        select: { id: true, documentId: true, content: true },
        take: 300,
        orderBy: { id: 'desc' },
      });
    }

    const scored = candidates
      .map((c) => ({
        chunkId: c.id,
        documentId: c.documentId,
        content: c.content,
        score: keywordOverlapScore(query, c.content),
        source: 'keyword' as const,
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return this.attachDocumentMeta(scored);
  }

  private async semanticSearch(
    query: string,
    topK: number,
    filters?: SearchOptions['filters'],
  ): Promise<SearchResult[]> {
    const embedding = await this.embedding.embed(query);
    let chunkIds: number[] | undefined;
    if (filters?.documentIds?.length) {
      const rows = await this.prisma.knowledgeChunk.findMany({
        where: {
          documentId: { in: filters.documentIds },
          ...(filters.language ? { language: filters.language } : {}),
        },
        select: { id: true },
        take: 8000,
      });
      chunkIds = rows.map((r) => r.id);
      if (chunkIds.length === 0) return [];
    }
    const vectorResults = await this.vector.search(embedding, topK * 3, { chunkIds });
    if (vectorResults.length === 0) return [];

    const ids = vectorResults.map((r) => r.chunkId);
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: {
        id: { in: ids },
        ...(filters?.documentIds
          ? { documentId: { in: filters.documentIds.length ? filters.documentIds : [-1] } }
          : {}),
        ...(filters?.language ? { language: filters.language } : {}),
      },
      select: { id: true, documentId: true, content: true },
    });
    const chunkMap = new Map(chunks.map((c) => [c.id, c]));

    const scored = vectorResults
      .filter((r) => chunkMap.has(r.chunkId))
      .slice(0, topK)
      .map((r) => {
        const c = chunkMap.get(r.chunkId)!;
        return {
          chunkId: c.id,
          documentId: c.documentId,
          content: c.content,
          score: r.score,
          source: 'semantic' as const,
        };
      });

    return this.attachDocumentMeta(scored);
  }

  async search(options: SearchOptions): Promise<SearchResponse> {
    const mode = options.mode ?? 'hybrid';
    const topK = Math.max(1, Math.min(options.topK ?? 10, 50));
    const query = (options.query ?? '').trim();
    if (!query) {
      return { query, mode, topK, results: [] };
    }

    const allowedIds = await this.resolveAllowedDocumentIds(options.userId, options.filters?.documentIds);
    const filters = {
      ...options.filters,
      documentIds: allowedIds,
    };

    let results: SearchResult[];
    if (mode === 'keyword') {
      results = await this.keywordSearch(query, topK, filters);
    } else if (mode === 'semantic') {
      try {
        results = await this.semanticSearch(query, topK, filters);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`semantic search fallback to keyword: ${message}`);
        results = await this.keywordSearch(query, topK, filters);
      }
    } else {
      const kw = await this.keywordSearch(query, topK, filters);
      let sem: SearchResult[] = [];
      try {
        sem = await this.semanticSearch(query, topK, filters);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`hybrid semantic leg skipped: ${message}`);
      }
      const map = new Map<number, SearchResult>();
      for (const r of kw) {
        map.set(r.chunkId, { ...r, score: r.score * 0.4, source: 'hybrid' });
      }
      for (const r of sem) {
        const existing = map.get(r.chunkId);
        if (existing) {
          existing.score = Math.max(existing.score, r.score * 0.6) + r.score * 0.3;
        } else {
          map.set(r.chunkId, { ...r, score: r.score * 0.6, source: 'hybrid' });
        }
      }
      results = Array.from(map.values()).sort((a, b) => b.score - a.score).slice(0, topK);
    }

    return { query, mode, topK, results };
  }
}
