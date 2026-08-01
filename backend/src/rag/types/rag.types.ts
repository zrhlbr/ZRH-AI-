/**
 * Stage 6 Enterprise RAG Engine 类型定义
 */

export type RagSearchMode = 'keyword' | 'semantic' | 'hybrid';

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
  /** 预留文件链接 */
  fileUrl?: string | null;
}

export interface RagRetrieveHit {
  chunkId: number;
  documentId: number;
  title: string;
  filename: string;
  content: string;
  page?: number | null;
  chunkIndex: number;
  score: number;
  source: 'keyword' | 'semantic' | 'hybrid' | 'rerank';
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

/** Chat / Agent 共用：只检索不生成 */
export interface RagPrepareResult {
  hit: boolean;
  rewrittenQuery: string;
  ranked: RagRetrieveHit[];
  citations: RagCitation[];
  relatedDocuments: Array<{ id: number; title: string; filename: string; score: number }>;
  knowledgeContext: string;
  topScore: number;
  metrics: Pick<
    RagAskMetrics,
    'rewriteMs' | 'retrieveMs' | 'rerankMs' | 'retrieveCount' | 'rerankCount' | 'citationCount' | 'hitRate'
  >;
}
