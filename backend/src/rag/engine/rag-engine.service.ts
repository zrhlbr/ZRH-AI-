import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AIGatewayService } from '../../ai/gateway/ai-gateway.service';
import { QueryRewriteService } from '../rewrite/query-rewrite.service';
import { RagRetrieverService } from '../retriever/rag-retriever.service';
import { RerankService } from '../rerank/rerank.service';
import { ContextBuilderService } from '../context/context-builder.service';
import { PromptBuilderService } from '../prompt/prompt-builder.service';
import { CitationService } from '../citation/citation.service';
import { ConversationMemoryService } from '../memory/conversation-memory.service';
import { RagPermissionService } from '../permission/rag-permission.service';
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
    private readonly redis: RedisService,
    private readonly gateway: AIGatewayService,
    private readonly rewrite: QueryRewriteService,
    private readonly retriever: RagRetrieverService,
    private readonly rerank: RerankService,
    private readonly context: ContextBuilderService,
    private readonly prompts: PromptBuilderService,
    private readonly citations: CitationService,
    private readonly memory: ConversationMemoryService,
    private readonly permissions: RagPermissionService,
  ) {}

  /** Chat / ask 统一默认命中阈值（CHAT_RAG_MIN_SCORE / ASK_RAG_MIN_SCORE / RAG_MIN_SCORE） */
  defaultMinScore(): number {
    const n = Number(process.env.RAG_MIN_SCORE ?? process.env.CHAT_RAG_MIN_SCORE ?? '0.28');
    return Number.isFinite(n) ? n : 0.28;
  }

  askMinScore(): number {
    const n = Number(process.env.ASK_RAG_MIN_SCORE ?? process.env.CHAT_RAG_MIN_SCORE ?? process.env.RAG_MIN_SCORE ?? '0.28');
    return Number.isFinite(n) ? n : 0.28;
  }

  /** Retrieve floor — keep candidates for rerank; hit threshold applied post-rerank */
  private retrieveFloor(minScore: number): number {
    return Math.min(0.05, minScore);
  }

  private cacheTtlSec(): number {
    const n = Number(process.env.RAG_CACHE_TTL_SEC ?? '60');
    return Number.isFinite(n) && n > 0 ? Math.min(n, 600) : 60;
  }

  private async cacheKey(
    userId: number,
    query: string,
    mode: string,
    topK: number,
    minScore: number,
  ): Promise<string> {
    const epochRaw = await this.redis.get('rag:acl:epoch');
    const epoch = Number(epochRaw ?? '0') || 0;
    const h = createHash('sha256')
      .update(`${mode}|${topK}|${minScore}|${query.trim().toLowerCase()}`)
      .digest('hex')
      .slice(0, 32);
    // Feature Freeze: bind prepare cache to ACL epoch so revoke cannot serve stale chunks
    return `rag:prep:v2:${epoch}:${userId}:${h}`;
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
    const key = await this.cacheKey(input.userId, input.query, mode, retrieveTopK, minScore);

    const cached = await this.redis.get(key);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as RagPrepareResult;
        // Defense in depth: drop hits that are no longer readable even within same epoch
        const ranked = await this.permissions.filterHitsByPermission(input.userId, parsed.ranked ?? []);
        if (ranked.length !== (parsed.ranked?.length ?? 0)) {
          if (ranked.length === 0) {
            this.logger.log(`rag prepare cache-stale-empty user=${input.userId}`);
          } else {
            const composed = this.context.compose(ranked);
            const citationList = this.citations.build(composed.includedHits);
            const topScore = ranked[0]?.score ?? 0;
            const hit = composed.includedHits.length > 0 && topScore >= minScore;
            return {
              ...parsed,
              hit,
              ranked,
              citations: hit ? citationList : [],
              relatedDocuments: hit ? this.citations.relatedDocuments(composed.includedHits) : [],
              knowledgeContext: hit ? composed.text : '',
              topScore,
              metrics: {
                ...parsed.metrics,
                rerankCount: ranked.length,
                citationCount: hit ? citationList.length : 0,
                hitRate: hit ? 1 : 0,
              },
            };
          }
        } else {
          this.logger.log(`rag prepare cache-hit user=${input.userId}`);
          return parsed;
        }
      } catch {
        // ignore bad cache
      }
    }

    const t0 = Date.now();
    const rewritten = await this.rewrite.rewrite(input.query);
    const rewriteMs = Date.now() - t0;

    const t1 = Date.now();
    const retrieved = await this.retriever.retrieve({
      userId: input.userId,
      query: rewritten.rewritten || rewritten.original,
      mode,
      topK: retrieveTopK,
      minScore: this.retrieveFloor(minScore),
    });
    const retrieveMs = Date.now() - t1;

    const t2 = Date.now();
    const ranked = this.rerank.rerank(rewritten.original, retrieved, rerankTopN);
    const rerankMs = Date.now() - t2;

    const composed = this.context.compose(ranked);
    // Stabilization R2: citations ⊆ injected context only
    const citationList = this.citations.build(composed.includedHits);
    const relatedDocuments = this.citations.relatedDocuments(composed.includedHits);
    const topScore = ranked[0]?.score ?? 0;
    const hit = composed.includedHits.length > 0 && topScore >= minScore;
    const hitRate = hit ? 1 : 0;

    this.logger.log(
      `rag prepare user=${input.userId} hit=${hit} topScore=${topScore.toFixed(3)} retrieve=${retrieved.length} rerank=${ranked.length} cited=${citationList.length}`,
    );

    const result: RagPrepareResult = {
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

    await this.redis.setex(key, this.cacheTtlSec(), JSON.stringify(result));
    return result;
  }

  async ask(input: {
    userId: number;
    query: string;
    conversationId?: number;
    mode?: RagSearchMode;
    modelRef?: string;
    topK?: number;
    minScore?: number;
  }): Promise<RagAskResult> {
    const started = Date.now();
    const prepared = await this.prepare({
      userId: input.userId,
      query: input.query,
      mode: input.mode,
      topK: input.topK,
      minScore: input.minScore ?? this.askMinScore(),
    });

    const knowledgeContext = prepared.hit ? prepared.knowledgeContext : '';
    const citationList = prepared.citations;
    const relatedDocuments = prepared.relatedDocuments;

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
    const prepared = await this.prepare({
      userId: input.userId,
      query: input.query,
      mode: input.mode,
      topK: input.topK,
      minScore: input.minScore,
    });
    return {
      rewrittenQuery: prepared.rewrittenQuery,
      retrieveCount: prepared.metrics.retrieveCount,
      results: prepared.ranked,
      citations: prepared.citations,
      relatedDocuments: prepared.relatedDocuments,
      latencyMs: prepared.metrics.rewriteMs + prepared.metrics.retrieveMs + prepared.metrics.rerankMs,
      hitRate: prepared.metrics.hitRate,
    };
  }
}
