/**
 * Stabilization Round 2 — shared keyword tokenization for CJK / Myanmar / Latin.
 * No ML; bigrams for scripts without spaces.
 */

export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

const CJK_MM = /[\u4e00-\u9fff\u3400-\u4dbf\u1000-\u109f\uaa60-\uaa7f\u1780-\u17ff]/;

export function tokenizeForKeyword(text: string): string[] {
  const parts = normalizeText(text).split(' ').filter(Boolean);
  const terms: string[] = [];
  for (const part of parts) {
    if (CJK_MM.test(part) && part.length >= 2) {
      for (let i = 0; i < part.length - 1; i++) terms.push(part.slice(i, i + 2));
      if (part.length <= 12) terms.push(part);
    } else {
      terms.push(part);
    }
  }
  return [...new Set(terms)];
}

export function keywordOverlapScore(query: string, content: string): number {
  const qTerms = tokenizeForKeyword(query);
  const cTerms = tokenizeForKeyword(content);
  if (!qTerms.length || !cTerms.length) {
    const nq = normalizeText(query);
    const nc = normalizeText(content);
    if (nq.length >= 2 && nc.includes(nq)) return 0.55;
    return 0;
  }
  const cSet = new Set(cTerms);
  const matches = qTerms.filter((t) => cSet.has(t)).length;
  let score = matches / qTerms.length;
  if (score === 0) {
    const nq = normalizeText(query);
    const nc = normalizeText(content);
    if (nq.length >= 2 && nc.includes(nq)) score = 0.55;
  }
  return score;
}

export function isIdeographicQuery(query: string): boolean {
  return CJK_MM.test(query);
}
