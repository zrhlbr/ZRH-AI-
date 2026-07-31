import { Injectable } from '@nestjs/common';
import { RagRetrieveHit } from '../types/rag.types';

/**
 * Re-ranking：对检索候选重排，默认 Top20 → Top5 再交给 LLM。
 */
@Injectable()
export class RerankService {
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  private overlapScore(query: string, content: string): number {
    const q = new Set(this.tokenize(query));
    const c = this.tokenize(content);
    if (!q.size || !c.length) return 0;
    let hits = 0;
    for (const t of c) if (q.has(t)) hits += 1;
    const coverage = [...q].filter((t) => c.includes(t)).length / q.size;
    return coverage * 0.7 + Math.min(1, hits / Math.max(c.length, 1)) * 0.3;
  }

  private lengthPenalty(content: string): number {
    const len = content.length;
    if (len < 40) return 0.7;
    if (len > 4000) return 0.85;
    return 1;
  }

  rerank(query: string, hits: RagRetrieveHit[], topN = 5): RagRetrieveHit[] {
    const n = Math.max(1, Math.min(topN, 20));
    return hits
      .map((h) => {
        const lexical = this.overlapScore(query, h.content);
        const score = h.score * 0.55 + lexical * 0.4;
        return {
          ...h,
          score: score * this.lengthPenalty(h.content),
          source: 'rerank' as const,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }
}
