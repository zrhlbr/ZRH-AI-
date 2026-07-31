import { Injectable } from '@nestjs/common';
import { RagAskResult } from '../types/rag.types';

/**
 * RAG Engine 编排入口（Stage 6 骨架）。
 * 后续模块逐步注入：Rewrite / Retriever / Rerank / Context / Prompt / Memory。
 */
@Injectable()
export class RagEngineService {
  async ask(_input: {
    userId: number;
    query: string;
    conversationId?: number;
    mode?: 'keyword' | 'semantic' | 'hybrid';
    modelRef?: string;
  }): Promise<RagAskResult> {
    throw new Error('RAG engine not ready: awaiting Stage 6 pipeline modules');
  }
}
