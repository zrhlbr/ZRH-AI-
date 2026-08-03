/**
 * Vector Provider 统一接口。
 * 所有向量存储（pgvector / Milvus / Qdrant 等）必须实现本接口。
 */

export interface VectorRecord {
  chunkId: number;
  embedding: number[];
}

export interface VectorSearchResult {
  chunkId: number;
  score: number;
}

export interface VectorProviderHealth {
  status: 'online' | 'offline' | 'error';
  error?: string;
  count?: number;
}

export interface IVectorProvider {
  readonly code: string;

  /** 初始化向量存储（表 / collection） */
  initialize(dimension: number): Promise<void>;

  /** 插入或更新向量 */
  insert(records: VectorRecord[]): Promise<void>;

  /** 删除向量化记录 */
  delete(chunkIds: number[]): Promise<void>;

  /** 相似度检索，返回 Top-K；可选 chunkIds 缩小扫描范围 */
  search(
    embedding: number[],
    topK: number,
    options?: { chunkIds?: number[] },
  ): Promise<VectorSearchResult[]>;

  /** 清空并重建索引 */
  rebuild(): Promise<void>;

  health(): Promise<VectorProviderHealth>;
}

export const VECTOR_PROVIDER = Symbol('VECTOR_PROVIDER');
