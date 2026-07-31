import { request } from './client';

export interface RagCitation {
  index: number;
  documentId: number;
  chunkId: number;
  title: string;
  filename: string;
  page?: number | null;
  chunkIndex: number;
  snippet: string;
  score: number;
  fileUrl?: string | null;
}

export interface RagAskMetrics {
  rewriteMs: number;
  retrieveMs: number;
  rerankMs: number;
  composeMs: number;
  generateMs: number;
  totalMs: number;
  retrieveCount: number;
  rerankCount: number;
  citationCount: number;
  hitRate: number;
}

export interface RagAskResult {
  answer: string;
  rewrittenQuery: string;
  citations: RagCitation[];
  relatedDocuments: Array<{ id: number; title: string; filename: string; score: number }>;
  metrics: RagAskMetrics;
  conversationId?: number;
}

export interface RagHealth {
  embedding: { ok: boolean; provider: string; latencyMs?: number; error?: string };
  vector: { ok: boolean; provider: string; count?: number; error?: string; providers?: Array<{ code: string; active: boolean }> };
  retriever: { ok: boolean; error?: string };
  synonyms: number;
  pendingEmbeddingTasks: number;
}

export const ragApi = {
  health: () => request<RagHealth>('/rag/health'),
  rewrite: (q: string, lang?: string) =>
    request<{ original: string; rewritten: string; expansions: string[]; language: string }>(
      `/rag/rewrite?q=${encodeURIComponent(q)}${lang ? `&lang=${lang}` : ''}`,
    ),
  search: (query: string, mode: 'keyword' | 'semantic' | 'hybrid' = 'hybrid', topK = 20) =>
    request<{
      rewrittenQuery: string;
      retrieveCount: number;
      results: Array<{ chunkId: number; title: string; content: string; score: number }>;
      citations: RagCitation[];
      relatedDocuments: Array<{ id: number; title: string; filename: string; score: number }>;
      latencyMs: number;
      hitRate: number;
    }>(`/rag/search?query=${encodeURIComponent(query)}&mode=${mode}&topK=${topK}`, { timeoutMs: 60000 }),
  ask: (data: {
    query: string;
    conversationId?: number;
    mode?: 'keyword' | 'semantic' | 'hybrid';
    modelRef?: string;
    topK?: number;
  }) =>
    request<RagAskResult>('/rag/ask', {
      method: 'POST',
      body: JSON.stringify(data),
      timeoutMs: 180000,
    }),
};
