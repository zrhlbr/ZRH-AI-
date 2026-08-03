import { Injectable } from '@nestjs/common';
import { RagRetrieveHit } from '../types/rag.types';

export interface ComposedContext {
  text: string;
  documentCount: number;
  chunkCount: number;
  /** Hits actually injected into prompt (citation-safe) */
  includedHits: RagRetrieveHit[];
  sources: Array<{ index: number; documentId: number; title: string; chunkId: number }>;
}

/**
 * Context Composer：自动组合多文档片段，控制总长度。
 * Stabilization R2: citations must only reference includedHits.
 */
@Injectable()
export class ContextBuilderService {
  compose(hits: RagRetrieveHit[], maxChars = 6000): ComposedContext {
    const parts: string[] = [];
    const includedHits: RagRetrieveHit[] = [];
    const sources: ComposedContext['sources'] = [];
    let used = 0;
    const seenDocs = new Set<number>();

    for (const hit of hits) {
      const provisionalIndex = includedHits.length + 1;
      const header = `[#${provisionalIndex}] ${hit.title} (${hit.filename}${hit.page ? ` p.${hit.page}` : ''} chunk:${hit.chunkIndex})`;
      const body = hit.content.trim();
      const block = `${header}\n${body}`;
      if (used + block.length > maxChars && parts.length > 0) break;
      parts.push(block);
      used += block.length + 2;
      seenDocs.add(hit.documentId);
      includedHits.push(hit);
      sources.push({
        index: provisionalIndex,
        documentId: hit.documentId,
        title: hit.title,
        chunkId: hit.chunkId,
      });
    }

    return {
      text: parts.join('\n\n---\n\n'),
      documentCount: seenDocs.size,
      chunkCount: parts.length,
      includedHits,
      sources,
    };
  }
}
