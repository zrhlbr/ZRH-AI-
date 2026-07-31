import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { DocumentService } from './documents/document.service';
import { ParserService } from './parser/parser.service';
import { ChunkService } from './chunk/chunk.service';
import { OllamaEmbeddingProvider } from './embedding/ollama-embedding.provider';
import { PgvectorProvider } from './vector/pgvector.provider';
import { RetrieverService } from './retriever/retriever.service';
import { KnowledgePermissionService } from './permissions/permission.service';
import { EmbeddingTaskService } from './tasks/embedding-task.service';
import { StorageService } from './storage/storage.service';
import { KnowledgeHealthService } from './health/knowledge-health.service';

/**
 * Knowledge Platform 模块（阶段 5）。
 * 统一入口：DocumentService / RetrieverService。
 * 禁止业务模块直接调用 Parser、Embedding、Vector。
 */
@Module({
  controllers: [KnowledgeController],
  providers: [
    DocumentService,
    ParserService,
    ChunkService,
    OllamaEmbeddingProvider,
    PgvectorProvider,
    RetrieverService,
    KnowledgePermissionService,
    EmbeddingTaskService,
    StorageService,
    KnowledgeHealthService,
  ],
  exports: [DocumentService, RetrieverService, KnowledgePermissionService],
})
export class KnowledgeModule {}
