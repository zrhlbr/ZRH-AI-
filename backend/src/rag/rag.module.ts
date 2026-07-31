import { Module } from '@nestjs/common';
import { AIModule } from '../ai/ai.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { RagController } from './rag.controller';
import { RagEngineService } from './engine/rag-engine.service';
import { RagPermissionService } from './permission/rag-permission.service';
import { VectorRegistryService } from './vector/vector-registry.service';
import { EmbeddingWorkerService } from './worker/embedding-worker.service';

/**
 * Stage 6 Enterprise RAG Engine。
 * 独立于 Knowledge Platform；通过 AIGateway 生成，不修改 Gateway 内部。
 */
@Module({
  imports: [AIModule, KnowledgeModule],
  controllers: [RagController],
  providers: [RagEngineService, RagPermissionService, VectorRegistryService, EmbeddingWorkerService],
  exports: [RagEngineService, RagPermissionService, VectorRegistryService],
})
export class RagModule {}
