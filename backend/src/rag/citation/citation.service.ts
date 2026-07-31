import { Injectable } from '@nestjs/common';
import { RagCitation, RagRetrieveHit } from '../types/rag.types';

/**
 * Citation：从重排结果生成可返回前端的引用来源。
 */
@Injectable()
export class CitationService {
  build(hits: RagRetrieveHit[]): RagCitation[] {
    return hits.map((h, i) => ({
      index: i + 1,
      documentId: h.documentId,
      chunkId: h.chunkId,
      title: h.title,
      filename: h.filename,
      page: h.page ?? null,
      chunkIndex: h.chunkIndex,
      snippet: h.content.slice(0, 280),
      score: h.score,
      fileUrl: null, // 预留
    }));
  }

  relatedDocuments(hits: RagRetrieveHit[]): Array<{ id: number; title: string; filename: string; score: number }> {
    const map = new Map<number, { id: number; title: string; filename: string; score: number }>();
    for (const h of hits) {
      const existing = map.get(h.documentId);
      if (!existing || h.score > existing.score) {
        map.set(h.documentId, {
          id: h.documentId,
          title: h.title,
          filename: h.filename,
          score: h.score,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.score - a.score);
  }
}
