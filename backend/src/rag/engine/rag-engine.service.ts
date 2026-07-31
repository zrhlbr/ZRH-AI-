import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AIGatewayService } from '../../ai/gateway/ai-gateway.service';
import { QueryRewriteService } from '../rewrite/query-rewrite.service';
import { RagRetrieverService } from '../retriever/rag-retriever.service';
import { RerankService } from '../rerank/rerank.service';
import { ContextBuilderService } from '../context/context-builder.service';
import { PromptBuilderService } from '../prompt/prompt-builder.service';
import { CitationService } from '../citation/citation.service';
import { ConversationMemoryService } from '../memory/conversation-memory.service';
import { RagAskResult, RagSearchMode } from '../types/rag.types';

/**
 * Enterprise RAG Engine 编排：
 * Rewrite → Retrieve(Top20) → Rerank(Top5) → Context → Prompt → Gateway Generate → Citations
 */
@Injectable()
export class RagEngineService {
  private readonly logger = new Logger(RagEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AIGatewayService,
    private readonly rewrite: QueryRewriteService,
    private readonly retriever: RagRetrieverService,
    private readonly rerank: RerankService,
    private readonly context: ContextBuilderService,
    private readonly prompts: PromptBuilderService,
    private readonly citations: CitationService,
    private readonly memory: ConversationMemoryService,
  ) {}

  async ask(input: {
    userId: number;
    query: string;
    conversationId?: number;
    mode?: RagSearchMode;
    modelRef?: string;
    topK?: number;
  }): Promise<RagAskResult> {
    const started = Date.now();
    const mode = input.mode ?? 'hybrid';
    const retrieveTopK = Math.max(5, Math.min(input.topK ?? 20, 50));
    const rerankTopN = 5;

    const t0 = Date.now();
    const rewritten = await this.rewrite.rewrite(input.query);
    const rewriteMs = Date.now() - t0;

    const t1 = Date.now();
    const retrieved = await this.retriever.retrieve({
      userId: input.userId,
      query: rewritten.rewritten || rewritten.original,
      mode,
      topK: retrieveTopK,
    });
    const retrieveMs = Date.now() - t1;

    const t2 = Date.now();
    const ranked = this.rerank.rerank(rewritten.original, retrieved, rerankTopN);
    const rerankMs = Date.now() - t2;

    const t3 = Date.now();
    const composed = this.context.compose(ranked);
    const memoryMessages = await this.memory.loadRecent(input.userId, input.conversationId);
    const messages = this.prompts.build({
      userQuery: rewritten.original,
      knowledgeContext: composed.text,
      memoryMessages,
    });
    const composeMs = Date.now() - t3;

    const t4 = Date.now();
    const answer = await this.gateway.generate(messages, input.modelRef);
    const generateMs = Date.now() - t4;

    const citationList = this.citations.build(ranked);
    const relatedDocuments = this.citations.relatedDocuments(ranked);
    const hitRate = retrieveTopK > 0 ? ranked.length / retrieveTopK : 0;

    const modelName = input.modelRef?.includes(':')
      ? input.modelRef.split(':').slice(1).join(':')
      : input.modelRef ?? 'default';

    const conversationId = await this.memory.persistTurn({
      userId: input.userId,
      conversationId: input.conversationId,
      model: modelName,
      question: rewritten.original,
      answer,
    });

    const totalMs = Date.now() - started;
    await this.prisma.ragQueryLog.create({
      data: {
        userId: input.userId,
        conversationId,
        originalQuery: rewritten.original,
        rewrittenQuery: rewritten.rewritten,
        mode,
        retrieveCount: retrieved.length,
        rerankCount: ranked.length,
        citationCount: citationList.length,
        hitRate,
        latencyMs: totalMs,
      },
    });

    this.logger.log(
      `rag ask user=${input.userId} retrieve=${retrieved.length} rerank=${ranked.length} totalMs=${totalMs}`,
    );

    return {
      answer,
      rewrittenQuery: rewritten.rewritten,
      citations: citationList,
      relatedDocuments,
      metrics: {
        rewriteMs,
        retrieveMs,
        rerankMs,
        composeMs,
        generateMs,
        totalMs,
        retrieveCount: retrieved.length,
        rerankCount: ranked.length,
        citationCount: citationList.length,
        hitRate,
      },
      conversationId,
    };
  }

  async search(input: {
    userId: number;
    query: string;
    mode?: RagSearchMode;
    topK?: number;
    minScore?: number;
  }) {
    const started = Date.now();
    const rewritten = await this.rewrite.rewrite(input.query);
    const retrieveTopK = Math.max(5, Math.min(input.topK ?? 20, 50));
    const retrieved = await this.retriever.retrieve({
      userId: input.userId,
      query: rewritten.rewritten || rewritten.original,
      mode: input.mode ?? 'hybrid',
      topK: retrieveTopK,
      minScore: input.minScore,
    });
    const ranked = this.rerank.rerank(rewritten.original, retrieved, 5);
    return {
      rewrittenQuery: rewritten.rewritten,
      retrieveCount: retrieved.length,
      results: ranked,
      citations: this.citations.build(ranked),
      relatedDocuments: this.citations.relatedDocuments(ranked),
      latencyMs: Date.now() - started,
      hitRate: retrieveTopK > 0 ? ranked.length / retrieveTopK : 0,
    };
  }
}
