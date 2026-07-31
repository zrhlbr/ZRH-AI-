import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OllamaEmbeddingProvider } from '../embedding/ollama-embedding.provider';
import { PgvectorProvider } from '../vector/pgvector.provider';

export interface SearchResult {
  chunkId: number;
  documentId: number;
  title: string;
  content: string;
  score: number;
  source: 'semantic' | 'keyword' | 'hybrid';
}

export interface SearchOptions {
  query: string;
  mode?: 'keyword' | 'semantic' | 'hybrid';
  topK?: number;
  filters?: { documentIds?: number[]; language?: string };
}

/**
 * Retriever：支持 Keyword / Semantic / Hybrid 检索。
 */
@Injectable()
export class RetrieverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: OllamaEmbeddingProvider,
    private readonly vector: PgvectorProvider,
  ) {}

  private normalize(text: string): string {
    return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ' ').replace(/\s+/g, ' ').trim();
  }

  private keywordScore(query: string, content: string): number {
    const qTerms = this.normalize(query).split(' ').filter(Boolean);
    const cTerms = this.normalize(content).split(' ').filter(Boolean);
    if (qTerms.length === 0 || cTerms.length === 0) return 0;
    const cSet = new Set(cTerms);
    const matches = qTerms.filter((t) => cSet.has(t)).length;
    return matches / qTerms.length;
  }

  private async keywordSearch(query: string, topK: number, filters?: SearchOptions['filters']): Promise<SearchResult[]> {
    const where: Record<string, unknown> = {};
    if (filters?.documentIds?.length) {
      where.documentId = { in: filters.documentIds };
    }
    if (filters?.language) {
      where.language = filters.language;
    }
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where,
      select: { id: true, documentId: true, content: true },
      take: 500,
    });
    const scored = chunks
      .map((c) => ({
        chunkId: c.id,
        documentId: c.documentId,
        content: c.content,
        score: this.keywordScore(query, c.content),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    const docIds = [...new Set(scored.map((s) => s.documentId))];
    const docs = await this.prisma.knowledgeDocument.findMany({
      where: { id: { in: docIds } },
      select: { id: true, title: true },
    });
    const titleMap = new Map(docs.map((d) => [d.id, d.title]));

    return scored.map((s) => ({
      chunkId: s.chunkId,
      documentId: s.documentId,
      title: titleMap.get(s.documentId) ?? '',
      content: s.content,
      score: s.score,
      source: 'keyword' as const,
    }));
  }

  private async semanticSearch(query: string, topK: number, filters?: SearchOptions['filters']): Promise<SearchResult[]> {
    const embedding = await this.embedding.embed(query);
    const vectorResults = await this.vector.search(embedding, topK * 3);
    if (vectorResults.length === 0) return [];

    const chunkIds = vectorResults.map((r) => r.chunkId);
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: {
        id: { in: chunkIds },
        ...(filters?.documentIds?.length ? { documentId: { in: filters.documentIds } } : {}),
        ...(filters?.language ? { language: filters.language } : {}),
      },
      select: { id: true, documentId: true, content: true },
    });
    const chunkMap = new Map(chunks.map((c) => [c.id, c]));

    const docIds = [...new Set(chunks.map((c) => c.documentId))];
    const docs = await this.prisma.knowledgeDocument.findMany({
      where: { id: { in: docIds } },
      select: { id: true, title: true },
    });
    const titleMap = new Map(docs.map((d) => [d.id, d.title]));

    return vectorResults
      .filter((r) => chunkMap.has(r.chunkId))
      .slice(0, topK)
      .map((r) => {
        const c = chunkMap.get(r.chunkId)!;
        return {
          chunkId: c.id,
          documentId: c.documentId,
          title: titleMap.get(c.documentId) ?? '',
          content: c.content,
          score: r.score,
          source: 'semantic' as const,
        };
      });
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const { query, mode = 'hybrid', topK = 10, filters } = options;
    if (mode === 'keyword') {
      return this.keywordSearch(query, topK, filters);
    }
    if (mode === 'semantic') {
      return this.semanticSearch(query, topK, filters);
    }
    // hybrid：合并并加权
    const [kw, sem] = await Promise.all([
      this.keywordSearch(query, topK, filters),
      this.semanticSearch(query, topK, filters),
    ]);
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
    return Array.from(map.values()).sort((a, b) => b.score - a.score).slice(0, topK);
  }
}
