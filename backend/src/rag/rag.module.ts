import { Module } from '@nestjs/common';
import { AIModule } from '../ai/ai.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { RagController } from './rag.controller';
import { RagEngineService } from './engine/rag-engine.service';

/**
 * Stage 6 Enterprise RAG Engine。
 * 独立于 Knowledge Platform；通过 AIGateway 生成，不修改 Gateway 内部。
 */
@Module({
  imports: [AIModule, KnowledgeModule],
  controllers: [RagController],
  providers: [RagEngineService],
  exports: [RagEngineService],
})
export class RagModule {}
