import { Module } from '@nestjs/common';
import { AIModule } from '../ai/ai.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { RagController } from './rag.controller';
import { RagEngineService } from './engine/rag-engine.service';
import { RagPermissionService } from './permission/rag-permission.service';
import { VectorRegistryService } from './vector/vector-registry.service';
import { EmbeddingWorkerService } from './worker/embedding-worker.service';
import { QueryRewriteService } from './rewrite/query-rewrite.service';
import { RagRetrieverService } from './retriever/rag-retriever.service';
import { RerankService } from './rerank/rerank.service';
import { ContextBuilderService } from './context/context-builder.service';
import { PromptBuilderService } from './prompt/prompt-builder.service';
import { CitationService } from './citation/citation.service';
import { ConversationMemoryService } from './memory/conversation-memory.service';
import { RagHealthService } from './health/rag-health.service';

/**
 * Stage 6 Enterprise RAG Engine。
 * 独立于 Knowledge Platform；通过 AIGateway 生成，不修改 Gateway 内部。
 */
@Module({
  imports: [AIModule, KnowledgeModule],
  controllers: [RagController],
  providers: [
    RagEngineService,
    RagPermissionService,
    VectorRegistryService,
    EmbeddingWorkerService,
    QueryRewriteService,
    RagRetrieverService,
    RerankService,
    ContextBuilderService,
    PromptBuilderService,
    CitationService,
    ConversationMemoryService,
    RagHealthService,
  ],
  exports: [RagEngineService, RagPermissionService, VectorRegistryService, PromptBuilderService],
})
export class RagModule {}
