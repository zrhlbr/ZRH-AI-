import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OllamaEmbeddingProvider } from '../../knowledge/embedding/ollama-embedding.provider';
import { keywordOverlapScore } from '../../knowledge/utils/text-tokenize';
import { RagPermissionService } from '../permission/rag-permission.service';
import { VectorRegistryService } from '../vector/vector-registry.service';
import { RagRetrieveHit, RagSearchMode } from '../types/rag.types';

export interface RagRetrieveOptions {
  userId: number;
  query: string;
  mode?: RagSearchMode;
  topK?: number;
  minScore?: number;
  filters?: {
    documentIds?: number[];
    folderId?: number;
    language?: string;
    tags?: number[];
  };
}

/**
 * Stage 6 RAG Retriever：Keyword / Semantic / Hybrid + TopK / Score / Filter + 权限。
 */
@Injectable()
export class RagRetrieverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: OllamaEmbeddingProvider,
    private readonly vectors: VectorRegistryService,
    private readonly permissions: RagPermissionService,
  ) {}

  private async resolveDocumentIds(userId: number, filters?: RagRetrieveOptions['filters']): Promise<number[]> {
    const allowed = await this.permissions.listAccessibleDocumentIds(userId);
    let ids = allowed;
    if (filters?.documentIds?.length) {
      const set = new Set(filters.documentIds);
      ids = ids.filter((id) => set.has(id));
    }
    if (filters?.folderId !== undefined) {
      const inFolder = await this.prisma.knowledgeDocument.findMany({
        where: { id: { in: ids }, folderId: filters.folderId },
        select: { id: true },
      });
      ids = inFolder.map((d) => d.id);
    }
    if (filters?.tags?.length) {
      const tagged = await this.prisma.knowledgeDocument.findMany({
        where: {
          id: { in: ids },
          tags: { some: { tagId: { in: filters.tags } } },
        },
        select: { id: true },
      });
      ids = tagged.map((d) => d.id);
    }
    return ids;
  }

  private async hydrate(chunkIds: number[], scores: Map<number, number>, source: RagRetrieveHit['source']): Promise<RagRetrieveHit[]> {
    if (chunkIds.length === 0) return [];
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: { id: { in: chunkIds } },
      include: { document: { select: { id: true, title: true, filename: true } } },
    });
    const map = new Map(chunks.map((c) => [c.id, c]));
    return chunkIds
      .map((id) => map.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => ({
        chunkId: c.id,
        documentId: c.documentId,
        title: c.document.title,
        filename: c.document.filename,
        content: c.content,
        page: c.page,
        chunkIndex: c.chunkIndex,
        score: scores.get(c.id) ?? 0,
        source,
      }));
  }

  private async keyword(query: string, documentIds: number[], topK: number, language?: string): Promise<RagRetrieveHit[]> {
    if (documentIds.length === 0) return [];
    const q = query.trim().slice(0, 100);
    const where: Prisma.KnowledgeChunkWhereInput = {
      documentId: { in: documentIds },
      ...(language ? { language } : {}),
      ...(q.length >= 2 ? { content: { contains: q, mode: 'insensitive' } } : {}),
    };
    let chunks = await this.prisma.knowledgeChunk.findMany({
      where,
      select: { id: true, content: true },
      take: 300,
      orderBy: { id: 'desc' },
    });
    if (chunks.length === 0) {
      chunks = await this.prisma.knowledgeChunk.findMany({
        where: {
          documentId: { in: documentIds },
          ...(language ? { language } : {}),
        },
        select: { id: true, content: true },
        take: 300,
        orderBy: { id: 'desc' },
      });
    }
    const scored = chunks
      .map((c) => ({ id: c.id, score: keywordOverlapScore(query, c.content) }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return this.hydrate(
      scored.map((s) => s.id),
      new Map(scored.map((s) => [s.id, s.score])),
      'keyword',
    );
  }

  private async semantic(query: string, documentIds: number[], topK: number, language?: string): Promise<RagRetrieveHit[]> {
    if (documentIds.length === 0) return [];
    const embedding = await this.embedding.embed(query);
    const candidateChunks = await this.prisma.knowledgeChunk.findMany({
      where: {
        documentId: { in: documentIds },
        ...(language ? { language } : {}),
      },
      select: { id: true },
      take: 8000,
    });
    const chunkIds = candidateChunks.map((c) => c.id);
    if (!chunkIds.length) return [];
    const vectorHits = await this.vectors
      .getActive()
      .search(embedding, Math.max(topK * 4, 20), { chunkIds });
    if (!vectorHits.length) return [];
    const filtered = vectorHits.slice(0, topK);
    return this.hydrate(
      filtered.map((h) => h.chunkId),
      new Map(filtered.map((h) => [h.chunkId, h.score])),
      'semantic',
    );
  }

  async retrieve(options: RagRetrieveOptions): Promise<RagRetrieveHit[]> {
    const mode = options.mode ?? 'hybrid';
    const topK = Math.max(1, Math.min(options.topK ?? 20, 50));
    const minScore = options.minScore ?? 0;
    const documentIds = await this.resolveDocumentIds(options.userId, options.filters);
    if (documentIds.length === 0) return [];

    let hits: RagRetrieveHit[];
    if (mode === 'keyword') {
      hits = await this.keyword(options.query, documentIds, topK, options.filters?.language);
    } else if (mode === 'semantic') {
      try {
        hits = await this.semantic(options.query, documentIds, topK, options.filters?.language);
      } catch {
        hits = await this.keyword(options.query, documentIds, topK, options.filters?.language);
      }
    } else {
      const kw = await this.keyword(options.query, documentIds, topK, options.filters?.language);
      let sem: RagRetrieveHit[] = [];
      try {
        sem = await this.semantic(options.query, documentIds, topK, options.filters?.language);
      } catch {
        sem = [];
      }
      const map = new Map<number, RagRetrieveHit>();
      for (const h of kw) map.set(h.chunkId, { ...h, score: h.score * 0.4, source: 'hybrid' });
      for (const h of sem) {
        const existing = map.get(h.chunkId);
        if (existing) existing.score = Math.max(existing.score, h.score * 0.6) + h.score * 0.3;
        else map.set(h.chunkId, { ...h, score: h.score * 0.6, source: 'hybrid' });
      }
      hits = [...map.values()].sort((a, b) => b.score - a.score).slice(0, topK);
    }

    return hits.filter((h) => h.score >= minScore);
  }
}
