import {
  IVectorProvider,
  VectorProviderHealth,
  VectorRecord,
  VectorSearchResult,
} from '../../knowledge/interfaces/vector-provider.interface';

/**
 * 预留向量后端 Stub（Stage 6）。
 * 不替换当前 JSONB PgvectorProvider；仅保留切换接口。
 */
export abstract class StubVectorProvider implements IVectorProvider {
  abstract readonly code: string;
  private readonly label: string;

  constructor(label: string) {
    this.label = label;
  }

  async initialize(_dimension: number): Promise<void> {
    // reserved
  }

  async insert(_records: VectorRecord[]): Promise<void> {
    throw new Error(`${this.label} vector provider not enabled in Stage 6`);
  }

  async delete(_chunkIds: number[]): Promise<void> {
    throw new Error(`${this.label} vector provider not enabled in Stage 6`);
  }

  async search(
    _embedding: number[],
    _topK: number,
    _options?: { chunkIds?: number[] },
  ): Promise<VectorSearchResult[]> {
    throw new Error(`${this.label} vector provider not enabled in Stage 6`);
  }

  async rebuild(): Promise<void> {
    throw new Error(`${this.label} vector provider not enabled in Stage 6`);
  }

  async health(): Promise<VectorProviderHealth> {
    return { status: 'offline', error: `${this.label} reserved (not enabled)` };
  }
}

export class MilvusVectorProvider extends StubVectorProvider {
  readonly code = 'milvus';
  constructor() {
    super('Milvus');
  }
}

export class QdrantVectorProvider extends StubVectorProvider {
  readonly code = 'qdrant';
  constructor() {
    super('Qdrant');
  }
}

export class ChromaVectorProvider extends StubVectorProvider {
  readonly code = 'chroma';
  constructor() {
    super('Chroma');
  }
}

export class FaissVectorProvider extends StubVectorProvider {
  readonly code = 'faiss';
  constructor() {
    super('FAISS');
  }
}
