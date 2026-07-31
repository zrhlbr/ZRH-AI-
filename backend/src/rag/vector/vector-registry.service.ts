import { Injectable } from '@nestjs/common';
import { IVectorProvider } from '../../knowledge/interfaces/vector-provider.interface';
import { PgvectorProvider } from '../../knowledge/vector/pgvector.provider';
import {
  ChromaVectorProvider,
  FaissVectorProvider,
  MilvusVectorProvider,
  QdrantVectorProvider,
} from './stub-vector.provider';

/**
 * Vector Provider Registry：默认使用 Stage 5 JSONB 实现，预留切换。
 */
@Injectable()
export class VectorRegistryService {
  private readonly providers = new Map<string, IVectorProvider>();

  constructor(private readonly pgvector: PgvectorProvider) {
    this.providers.set(pgvector.code, pgvector);
    for (const stub of [
      new MilvusVectorProvider(),
      new QdrantVectorProvider(),
      new ChromaVectorProvider(),
      new FaissVectorProvider(),
    ]) {
      this.providers.set(stub.code, stub);
    }
  }

  getActive(): IVectorProvider {
    const code = (process.env.RAG_VECTOR_PROVIDER ?? 'pgvector').toLowerCase();
    return this.providers.get(code) ?? this.pgvector;
  }

  get(code: string): IVectorProvider | undefined {
    return this.providers.get(code);
  }

  list(): Array<{ code: string; active: boolean }> {
    const active = this.getActive().code;
    return [...this.providers.keys()].map((code) => ({ code, active: code === active }));
  }
}
