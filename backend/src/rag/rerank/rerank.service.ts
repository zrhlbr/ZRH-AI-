import { Injectable } from '@nestjs/common';
import { tokenizeForKeyword } from '../../knowledge/utils/text-tokenize';
import { RagRetrieveHit } from '../types/rag.types';

/**
 * Re-ranking：对检索候选重排，默认 Top20 → Top5 再交给 LLM。
 * Stabilization R2: title boost, bigram, proximity, document diversity.
 */
@Injectable()
export class RerankService {
  private overlapScore(query: string, content: string): number {
    const q = tokenizeForKeyword(query);
    const c = tokenizeForKeyword(content);
    if (!q.length || !c.length) return 0;
    const cSet = new Set(c);
    const matched = q.filter((t) => cSet.has(t)).length;
    const coverage = matched / q.length;
    // unique coverage primary; density secondary (reduced)
    const density = Math.min(1, matched / Math.max(c.length, 1));
    let score = coverage * 0.85 + density * 0.15;

    // adjacent bigrams in content
    let bigram = 0;
    for (let i = 0; i < q.length - 1; i++) {
      const a = q[i];
      const b = q[i + 1];
      const needle = `${a}${b}`;
      const spaced = `${a} ${b}`;
      const lower = content.toLowerCase();
      if (lower.includes(needle) || lower.includes(spaced)) bigram += 0.03;
    }
    score += Math.min(0.09, bigram);

    // proximity: first match in first 400 chars
    const first = q.find((t) => content.toLowerCase().includes(t));
    if (first) {
      const idx = content.toLowerCase().indexOf(first);
      if (idx >= 0 && idx < 400) score += 0.05;
    }

    return Math.min(1, score);
  }

  private lengthPenalty(content: string): number {
    const len = content.length;
    if (len < 40) return 0.7;
    if (len > 4000) return 0.85;
    return 1;
  }

  private titleBoost(query: string, hit: RagRetrieveHit): number {
    const q = tokenizeForKeyword(query);
    const titleTokens = new Set(tokenizeForKeyword(`${hit.title} ${hit.filename}`));
    if (!q.length || !titleTokens.size) return 0;
    const hits = q.filter((t) => titleTokens.has(t)).length;
    return hits > 0 ? Math.min(0.08, 0.04 + hits * 0.02) : 0;
  }

  rerank(query: string, hits: RagRetrieveHit[], topN = 5): RagRetrieveHit[] {
    const n = Math.max(1, Math.min(topN, 20));
    const scored = hits
      .map((h) => {
        const lexical = this.overlapScore(query, h.content);
        const score = (h.score * 0.55 + lexical * 0.4 + this.titleBoost(query, h)) * this.lengthPenalty(h.content);
        return {
          ...h,
          score,
          source: 'rerank' as const,
        };
      })
      .sort((a, b) => b.score - a.score);

    // Document diversity: prefer new documentIds until filled
    const picked: RagRetrieveHit[] = [];
    const seenDocs = new Set<number>();
    for (const h of scored) {
      if (picked.length >= n) break;
      if (!seenDocs.has(h.documentId)) {
        picked.push(h);
        seenDocs.add(h.documentId);
      }
    }
    for (const h of scored) {
      if (picked.length >= n) break;
      if (!picked.some((p) => p.chunkId === h.chunkId)) picked.push(h);
    }
    return picked;
  }
}
