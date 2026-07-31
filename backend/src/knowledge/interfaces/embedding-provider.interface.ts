/**
 * Embedding Provider 统一接口。
 * 禁止业务模块直接调用 Ollama 或 OpenAI 生成 Embedding。
 */

export interface EmbeddingProviderHealth {
  status: 'online' | 'offline' | 'error';
  latencyMs?: number;
  error?: string;
}

export interface IEmbeddingProvider {
  readonly code: string;
  readonly dimension: number;

  isEnabled(): boolean;

  /** 单文本 embedding */
  embed(text: string): Promise<number[]>;

  /** 批量 embedding */
  embedBatch(texts: string[]): Promise<number[][]>;

  health(): Promise<EmbeddingProviderHealth>;
}

export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');
