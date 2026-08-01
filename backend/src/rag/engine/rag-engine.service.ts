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
import { RagAskResult, RagPrepareResult, RagSearchMode } from '../types/rag.types';

/**
 * Enterprise RAG Engine 编排：
 * Rewrite → Retrieve(Top20) → Rerank(Top5) → Context → Prompt → Gateway Generate → Citations
 * Chat 集成通过 prepare() 只取检索结果，再自行流式生成。
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

  /** 默认命中阈值（Chat 可用 CHAT_RAG_MIN_SCORE 覆盖） */
  defaultMinScore(): number {
    const n = Number(process.env.CHAT_RAG_MIN_SCORE ?? '0.28');
    return Number.isFinite(n) ? n : 0.28;
  }

  /**
   * 只检索不生成：供 Chat 流式集成与 ask() 复用。
   * 不调用 gateway.generate，不 persistTurn。
   */
  async prepare(input: {
    userId: number;
    query: string;
    mode?: RagSearchMode;
    topK?: number;
    minScore?: number;
  }): Promise<RagPrepareResult> {
    const mode = input.mode ?? 'hybrid';
    const retrieveTopK = Math.max(5, Math.min(input.topK ?? 20, 50));
    const rerankTopN = 5;
    const minScore = input.minScore ?? this.defaultMinScore();

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

    const composed = this.context.compose(ranked);
    const citationList = this.citations.build(ranked);
    const relatedDocuments = this.citations.relatedDocuments(ranked);
    const topScore = ranked[0]?.score ?? 0;
    const hit = ranked.length > 0 && topScore >= minScore;
    const hitRate = retrieveTopK > 0 ? ranked.length / retrieveTopK : 0;

    this.logger.log(
      `rag prepare user=${input.userId} hit=${hit} topScore=${topScore.toFixed(3)} retrieve=${retrieved.length} rerank=${ranked.length}`,
    );

    return {
      hit,
      rewrittenQuery: rewritten.rewritten,
      ranked,
      citations: hit ? citationList : [],
      relatedDocuments: hit ? relatedDocuments : [],
      knowledgeContext: hit ? composed.text : '',
      topScore,
      metrics: {
        rewriteMs,
        retrieveMs,
        rerankMs,
        retrieveCount: retrieved.length,
        rerankCount: ranked.length,
        citationCount: hit ? citationList.length : 0,
        hitRate,
      },
    };
  }

  async ask(input: {
    userId: number;
    query: string;
    conversationId?: number;
    mode?: RagSearchMode;
    modelRef?: string;
    topK?: number;
  }): Promise<RagAskResult> {
    const started = Date.now();
    // /rag/ask 与 Agent：有检索结果即注入上下文（低阈值），保持原页面行为
    const prepared = await this.prepare({
      userId: input.userId,
      query: input.query,
      mode: input.mode,
      topK: input.topK,
      minScore: 0.05,
    });

    const knowledgeContext =
      prepared.ranked.length > 0 ? this.context.compose(prepared.ranked).text : '';

    const t3 = Date.now();
    const memoryMessages = await this.memory.loadRecent(input.userId, input.conversationId);
    const askMessages = this.prompts.build({
      userQuery: input.query,
      knowledgeContext,
      memoryMessages,
    });
    const composeMs = Date.now() - t3;

    const t4 = Date.now();
    const answer = await this.gateway.generate(askMessages, input.modelRef);
    const generateMs = Date.now() - t4;

    const citationList = this.citations.build(prepared.ranked);
    const relatedDocuments = this.citations.relatedDocuments(prepared.ranked);

    const modelName = input.modelRef?.includes(':')
      ? input.modelRef.split(':').slice(1).join(':')
      : input.modelRef ?? 'default';

    const conversationId = await this.memory.persistTurn({
      userId: input.userId,
      conversationId: input.conversationId,
      model: modelName,
      question: input.query,
      answer,
    });

    const totalMs = Date.now() - started;
    await this.prisma.ragQueryLog.create({
      data: {
        userId: input.userId,
        conversationId,
        originalQuery: input.query,
        rewrittenQuery: prepared.rewrittenQuery,
        mode: input.mode ?? 'hybrid',
        retrieveCount: prepared.metrics.retrieveCount,
        rerankCount: prepared.metrics.rerankCount,
        citationCount: citationList.length,
        hitRate: prepared.metrics.hitRate,
        latencyMs: totalMs,
      },
    });

    this.logger.log(
      `rag ask user=${input.userId} retrieve=${prepared.metrics.retrieveCount} rerank=${prepared.metrics.rerankCount} totalMs=${totalMs}`,
    );

    return {
      answer,
      rewrittenQuery: prepared.rewrittenQuery,
      citations: citationList,
      relatedDocuments,
      metrics: {
        rewriteMs: prepared.metrics.rewriteMs,
        retrieveMs: prepared.metrics.retrieveMs,
        rerankMs: prepared.metrics.rerankMs,
        composeMs,
        generateMs,
        totalMs,
        retrieveCount: prepared.metrics.retrieveCount,
        rerankCount: prepared.metrics.rerankCount,
        citationCount: citationList.length,
        hitRate: prepared.metrics.hitRate,
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
