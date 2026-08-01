import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { Subscription } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AIGatewayService } from '../ai/gateway/ai-gateway.service';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import { RagEngineService } from '../rag/engine/rag-engine.service';
import { PromptBuilderService } from '../rag/prompt/prompt-builder.service';
import { RagCitation } from '../rag/types/rag.types';
import {
  ConversationListQueryDto,
  MessagesQueryDto,
  SendMessageDto,
  UpdateConversationDto,
  UpdateMessageDto,
  UpdateParamsDto,
} from './dto/chat.dto';
import { AIMessage, AIStreamChunk } from '../ai/types/ai.types';

interface ActiveGeneration {
  conversationId: number;
  model: string;
  stoppedByUser: boolean;
}

const HISTORY_LIMIT = 30;
const CONTINUE_HINT = 'continue';

/**
 * AI 对话核心服务（阶段 4 + V1.1 Chat↔RAG）
 * - send/regenerate 默认经 Enterprise RAG prepare，命中则注入知识上下文再 Gateway.stream
 * - 未命中透明回退原 Chat 路径；continue 不重检索
 * - 所有 LLM 生成仍经 AIGatewayService，禁止直接调用 Ollama
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  /** 进行中的生成：key = `${userId}:${conversationId}` */
  private readonly active = new Map<string, ActiveGeneration>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AIGatewayService,
    private readonly rag: RagEngineService,
    private readonly ragPrompts: PromptBuilderService,
  ) {}

  private chatRagEnabled(): boolean {
    return (process.env.CHAT_RAG_ENABLED ?? 'true').toLowerCase() !== 'false';
  }

  // ---------- 对话 CRUD ----------

  async listConversations(userId: number, q: ConversationListQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const where: Prisma.ConversationWhereInput = {
      userId,
      ...(q.search ? { title: { contains: q.search, mode: 'insensitive' as const } } : {}),
      ...(q.pinned === 1 ? { pinned: true } : {}),
      ...(q.favorite === 1 ? { favorite: true } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { lastMessageAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { messages: true } },
          messages: { orderBy: { id: 'desc' }, take: 1, select: { content: true, role: true } },
        },
      }),
    ]);
    return {
      page,
      pageSize,
      total,
      items: items.map((c) => ({
        id: c.id,
        title: c.title,
        model: c.model,
        pinned: c.pinned,
        favorite: c.favorite,
        folderId: c.folderId,
        messageCount: c._count.messages,
        preview: c.messages[0]?.content.slice(0, 60) ?? '',
        createdAt: c.createdAt,
        lastMessageAt: c.lastMessageAt,
      })),
    };
  }

  async getConversation(userId: number, id: number, q: MessagesQueryDto) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id, userId } });
    if (!conversation) throw new NotFoundException('conversation not found');
    const limit = q.limit ?? 30;
    const where: Prisma.MessageWhereInput = {
      conversationId: id,
      ...(q.before ? { id: { lt: q.before } } : {}),
    };
    const rows = await this.prisma.message.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const messages = rows.slice(0, limit).reverse();
    return {
      conversation: {
        id: conversation.id,
        title: conversation.title,
        model: conversation.model,
        pinned: conversation.pinned,
        favorite: conversation.favorite,
        promptCode: conversation.promptCode,
        systemPrompt: conversation.systemPrompt,
        folderId: conversation.folderId,
        createdAt: conversation.createdAt,
        lastMessageAt: conversation.lastMessageAt,
      },
      messages,
      hasMore,
    };
  }

  async updateConversation(userId: number, id: number, dto: UpdateConversationDto) {
    const existing = await this.prisma.conversation.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('conversation not found');
    if (dto.model && dto.model !== existing.model) {
      this.logger.log(`model switch user=${userId} conv=${id} ${existing.model} -> ${dto.model}`);
    }
    return this.prisma.conversation.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.pinned !== undefined ? { pinned: dto.pinned } : {}),
        ...(dto.favorite !== undefined ? { favorite: dto.favorite } : {}),
        ...(dto.folderId !== undefined ? { folderId: dto.folderId } : {}),
        ...(dto.model ? { model: dto.model } : {}),
        ...(dto.systemPrompt !== undefined ? { systemPrompt: dto.systemPrompt } : {}),
        ...(dto.promptCode !== undefined ? { promptCode: dto.promptCode } : {}),
      },
    });
  }

  async deleteConversation(userId: number, id: number) {
    const existing = await this.prisma.conversation.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('conversation not found');
    this.stopGeneration(userId, id);
    await this.prisma.conversation.delete({ where: { id } });
    return { deleted: true };
  }

  // ---------- 消息管理 ----------

  async updateMessage(userId: number, messageId: number, dto: UpdateMessageDto) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversation: { userId } },
    });
    if (!message) throw new NotFoundException('message not found');
    return this.prisma.message.update({
      where: { id: messageId },
      data: { feedback: dto.feedback === undefined ? message.feedback : dto.feedback },
    });
  }

  async deleteMessage(userId: number, messageId: number) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversation: { userId } },
    });
    if (!message) throw new NotFoundException('message not found');
    await this.prisma.message.delete({ where: { id: messageId } });
    return { deleted: true };
  }

  async exportConversation(userId: number, id: number, format: 'md' | 'json') {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: { id: 'asc' } } },
    });
    if (!conversation) throw new NotFoundException('conversation not found');
    if (format === 'json') {
      return {
        mime: 'application/json',
        filename: `zrh-ai-chat-${id}.json`,
        body: JSON.stringify(conversation, null, 2),
      };
    }
    const lines = [
      `# ${conversation.title}`,
      '',
      `- model: ${conversation.model}`,
      `- exported: ${new Date().toISOString()}`,
      '',
    ];
    for (const m of conversation.messages) {
      const who = m.role === 'user' ? 'User' : m.role === 'assistant' ? `Assistant (${m.model ?? ''})` : 'System';
      lines.push(`## ${who} · ${m.createdAt.toISOString()}`, '', m.content, '');
    }
    return { mime: 'text/markdown', filename: `zrh-ai-chat-${id}.md`, body: lines.join('\n') };
  }

  // ---------- 模型 / 参数 / Prompt ----------

  async listModels() {
    const [configs, registryModels, providerHealth] = await Promise.all([
      this.prisma.modelConfig.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.gateway.listModels().catch(() => []),
      this.gateway.checkProvider('ollama').catch(() => ({ status: 'offline' as const })),
    ]);
    const installed = new Map(registryModels.map((m) => [m.name, m]));
    return {
      ollama: providerHealth.status,
      models: configs.map((c) => ({
        name: c.name,
        displayName: c.displayName,
        enabled: c.enabled,
        isDefault: c.isDefault,
        installed: installed.has(c.name),
        sizeBytes: installed.get(c.name)?.sizeBytes ?? null,
      })),
    };
  }

  async modelsStatus() {
    const [configs, registryModels, loaded, providerHealth] = await Promise.all([
      this.prisma.modelConfig.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.gateway.listModels().catch(() => []),
      this.gateway.loadedModels('ollama').catch(() => []),
      this.gateway.checkProvider('ollama').catch(() => ({ status: 'offline' as const })),
    ]);
    if (providerHealth.status !== 'online') {
      return {
        ollama: 'offline',
        models: configs.map((c) => ({ name: c.name, displayName: c.displayName, status: 'error' as const })),
      };
    }
    const installed = new Set(registryModels.map((m) => m.name));
    const loadedMap = new Map(loaded.map((m) => [m.name, m]));
    const generatingModels = new Set([...this.active.values()].map((a) => a.model));
    return {
      ollama: 'online',
      models: configs.map((c) => {
        let status: 'online' | 'loading' | 'running' | 'stopped' | 'error';
        if (!c.enabled) status = 'stopped';
        else if (!installed.has(c.name)) status = 'stopped';
        else if (generatingModels.has(c.name)) status = 'running';
        else if (loadedMap.has(c.name)) status = 'online';
        else status = 'loading';
        return {
          name: c.name,
          displayName: c.displayName,
          status,
          installed: installed.has(c.name),
          vramBytes: loadedMap.get(c.name)?.sizeVram ?? null,
        };
      }),
    };
  }

  async getParams(userId: number) {
    const existing = await this.prisma.chatParams.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.prisma.chatParams.create({ data: { userId } });
  }

  async updateParams(userId: number, dto: UpdateParamsDto) {
    const data: Prisma.ChatParamsUpdateInput = {
      ...(dto.temperature !== undefined ? { temperature: dto.temperature } : {}),
      ...(dto.topP !== undefined ? { topP: dto.topP } : {}),
      ...(dto.topK !== undefined ? { topK: dto.topK } : {}),
      ...(dto.repeatPenalty !== undefined ? { repeatPenalty: dto.repeatPenalty } : {}),
      ...(dto.contextLength !== undefined ? { contextLength: dto.contextLength } : {}),
      ...(dto.maxTokens !== undefined ? { maxTokens: dto.maxTokens } : {}),
      ...(dto.seed !== undefined ? { seed: dto.seed } : {}),
    };
    return this.prisma.chatParams.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data } as Prisma.ChatParamsUncheckedCreateInput,
    });
  }

  async listPrompts() {
    return this.gateway.listPrompts();
  }

  async stats(userId: number) {
    const [conversations, messages, models] = await Promise.all([
      this.prisma.conversation.count({ where: { userId } }),
      this.prisma.message.count({ where: { conversation: { userId } } }),
      this.prisma.modelConfig.count({ where: { enabled: true } }),
    ]);
    return { conversations, messages, models, activeGenerations: this.active.size };
  }

  // ---------- 停止 ----------

  stopGeneration(userId: number, conversationId: number): boolean {
    const key = `${userId}:${conversationId}`;
    const gen = this.active.get(key);
    if (!gen) return false;
    gen.stoppedByUser = true;
    const stopped = this.gateway.stop(conversationId);
    this.logger.log(`generation stopped by user=${userId} conv=${conversationId} gateway=${stopped}`);
    return true;
  }

  // ---------- 流式生成（核心） ----------

  /**
   * 统一流式管线：send / continue / regenerate 三种模式。
   * 直接写 SSE 响应，绕过统一返回包装（控制器使用 @Res()）。
   */
  async stream(
    user: AuthUser,
    dto: SendMessageDto,
    mode: 'send' | 'continue' | 'regenerate',
    req: Request,
    res: Response,
  ): Promise<void> {
    const sse = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let conversationId = dto.conversationId;
    let assistantMessageId: number | null = null;
    let appendToMessageId: number | null = null;
    let accumulated = '';
    let finished = false;
    let subscription: Subscription | undefined;
    const startedAt = Date.now();
    const gen: ActiveGeneration = {
      conversationId: conversationId ?? -1,
      model: '',
      stoppedByUser: false,
    };

    try {
      // 1. 解析 / 创建对话
      let conversation = conversationId
        ? await this.prisma.conversation.findFirst({ where: { id: conversationId, userId: user.id } })
        : null;
      if (conversationId && !conversation) throw new NotFoundException('conversation not found');

      const model = dto.model ?? conversation?.model ?? (await this.defaultModel());
      if (!conversation) {
        const title = (dto.message ?? 'New Chat').trim().replace(/\s+/g, ' ').slice(0, 30) || 'New Chat';
        conversation = await this.prisma.conversation.create({
          data: {
            userId: user.id,
            title,
            model,
            promptCode: dto.promptCode ?? null,
          },
        });
        conversationId = conversation.id;
        gen.conversationId = conversation.id;
      } else if (dto.model && dto.model !== conversation.model) {
        this.logger.log(`model switch user=${user.id} conv=${conversation.id} ${conversation.model} -> ${dto.model}`);
        conversation = await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { model: dto.model },
        });
      }
      gen.model = model;

      // 2. 按模式准备历史与持久化用户消息
      const historyRows = await this.prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { id: 'desc' },
        take: HISTORY_LIMIT,
      });
      const recent = historyRows.reverse();

      if (mode === 'send') {
        if (!dto.message?.trim()) throw new BadRequestException('message is required');
        const userMessage = await this.prisma.message.create({
          data: { conversationId: conversation.id, role: 'user', content: dto.message.trim(), model },
        });
        recent.push(userMessage);
        sse({ type: 'meta', conversationId: conversation.id, userMessageId: userMessage.id, model });
      } else if (mode === 'continue') {
        const last = recent[recent.length - 1];
        if (!last || last.role !== 'assistant') {
          throw new BadRequestException('nothing to continue');
        }
        appendToMessageId = last.id;
        accumulated = last.content;
        recent.push({ ...last, id: -1, role: 'user', content: CONTINUE_HINT } as unknown as typeof last);
        sse({ type: 'meta', conversationId: conversation.id, appendToMessageId, model });
      } else {
        const last = recent[recent.length - 1];
        if (!last || last.role !== 'assistant') {
          throw new BadRequestException('nothing to regenerate');
        }
        await this.prisma.message.delete({ where: { id: last.id } });
        recent.pop();
        sse({ type: 'meta', conversationId: conversation.id, replacedMessageId: last.id, model });
      }

      // 3. System Prompt（未命中 RAG 时使用；命中时可叠加）
      const systemPrompt = await this.gateway.resolveSystemPrompt(conversation.systemPrompt, dto.promptCode ?? conversation.promptCode);

      // 4. 生成参数
      const params = await this.getParams(user.id);

      // 5. Enterprise RAG prepare（send/regenerate）；continue 不重检索
      let ragHit: boolean | null = null;
      let ragCitations: RagCitation[] = [];
      let ragRewrittenQuery: string | null = null;
      let messages: AIMessage[];

      const userQuery =
        mode === 'send'
          ? (dto.message ?? '').trim()
          : [...recent].reverse().find((m) => m.role === 'user')?.content?.trim() ?? '';

      if (this.chatRagEnabled() && mode !== 'continue' && userQuery) {
        try {
          const prepared = await this.rag.prepare({
            userId: user.id,
            query: userQuery,
            mode: 'hybrid',
          });
          ragHit = prepared.hit;
          ragCitations = prepared.citations;
          ragRewrittenQuery = prepared.rewrittenQuery;

          if (prepared.hit) {
            sse({
              type: 'rag',
              hit: true,
              rewrittenQuery: prepared.rewrittenQuery,
              citations: prepared.citations,
              relatedDocuments: prepared.relatedDocuments,
              metrics: prepared.metrics,
            });
            const historyForRag = recent
              .filter((m) => m.role === 'user' || m.role === 'assistant')
              .slice(0, -1)
              .slice(-6)
              .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
            messages = this.ragPrompts.build({
              userQuery,
              knowledgeContext: prepared.knowledgeContext,
              memoryMessages: historyForRag,
              extraSystemPrompt: systemPrompt || undefined,
            });
            this.logger.log(
              `chat rag hit user=${user.id} conv=${conversation.id} citations=${prepared.citations.length} top1=${prepared.ranked[0]?.score?.toFixed(3) ?? '-'}`,
            );
          } else {
            sse({ type: 'rag', hit: false });
            messages = [
              ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
              ...recent.map((m) => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
            ];
            this.logger.log(`chat rag miss user=${user.id} conv=${conversation.id}`);
          }
        } catch (ragErr) {
          this.logger.warn(
            `chat rag prepare failed, fallback plain stream: ${ragErr instanceof Error ? ragErr.message : String(ragErr)}`,
          );
          sse({ type: 'rag', hit: false, error: true });
          ragHit = false;
          messages = [
            ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
            ...recent.map((m) => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
          ];
        }
      } else {
        messages = [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          ...recent.map((m) => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
        ];
      }

      // 6. 统一经 Gateway 启动流式生成
      const key = `${user.id}:${conversation.id}`;
      const existing = this.active.get(key);
      if (existing && !existing.stoppedByUser) {
        existing.stoppedByUser = true;
        this.gateway.stop(conversation.id);
      }
      this.active.set(key, gen);
      req.on('close', () => {
        if (!finished) {
          gen.stoppedByUser = true;
          this.gateway.stop(conversation.id);
        }
      });

      this.logger.log(
        `generation start user=${user.id} conv=${conversation.id} model=${model} mode=${mode} ragHit=${ragHit}`,
      );
      const { stream } = await this.gateway.stream(messages, {
        conversationId: conversation.id,
        modelRef: model,
        temperature: params.temperature,
        topP: params.topP,
        topK: params.topK,
        repeatPenalty: params.repeatPenalty,
        contextLength: params.contextLength,
        maxTokens: params.maxTokens,
        seed: params.seed,
      });

      // 7. 订阅并转发 chunk
      let promptTokens: number | null = null;
      let completionTokens: number | null = null;
      let durationMs: number | null = null;

      await new Promise<void>((resolve, reject) => {
        subscription = stream.subscribe({
          next: (chunk: AIStreamChunk) => {
            if (chunk.type === 'delta' && chunk.content) {
              accumulated += chunk.content;
              sse({ type: 'delta', content: chunk.content });
            } else if (chunk.type === 'done') {
              promptTokens = chunk.promptTokens ?? null;
              completionTokens = chunk.completionTokens ?? null;
              durationMs = chunk.durationMs ?? null;
            } else if (chunk.type === 'error') {
              reject(new BadRequestException(chunk.message ?? 'stream error'));
            }
          },
          error: (error: unknown) => {
            reject(error instanceof Error ? error : new Error(String(error)));
          },
          complete: () => resolve(),
        });
      });

      // 8. 持久化 assistant 消息（命中时写入 citations）
      const status = gen.stoppedByUser ? 'stopped' : 'done';
      const finalDurationMs = durationMs ?? Date.now() - startedAt;
      const ragFields =
        ragHit === true
          ? {
              ragHit: true,
              citations: ragCitations as unknown as Prisma.InputJsonValue,
              rewrittenQuery: ragRewrittenQuery,
            }
          : ragHit === false
            ? { ragHit: false }
            : {};

      if (appendToMessageId) {
        await this.prisma.message.update({
          where: { id: appendToMessageId },
          data: {
            content: accumulated,
            status,
            durationMs: finalDurationMs,
            promptTokens,
            completionTokens,
          },
        });
        assistantMessageId = appendToMessageId;
      } else {
        const assistantMessage = await this.prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: 'assistant',
            content: accumulated,
            model,
            status,
            durationMs: finalDurationMs,
            promptTokens,
            completionTokens,
            ...ragFields,
          },
        });
        assistantMessageId = assistantMessage.id;
      }
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      finished = true;
      sse({
        type: 'done',
        conversationId: conversation.id,
        messageId: assistantMessageId,
        status,
        promptTokens,
        completionTokens,
        durationMs: finalDurationMs,
        ragHit,
        citations: ragHit ? ragCitations : undefined,
      });
      this.logger.log(
        `generation ${status} user=${user.id} conv=${conversation.id} model=${model} durationMs=${finalDurationMs} ragHit=${ragHit}`,
      );
    } catch (error) {
      const isAbort = gen.stoppedByUser;
      const message = error instanceof Error ? error.message : String(error);
      if (isAbort) {
        if (accumulated && conversationId) {
          try {
            const partialId = assistantMessageId ?? appendToMessageId;
            if (partialId) {
              await this.prisma.message.update({
                where: { id: partialId },
                data: { content: accumulated, status: 'stopped', durationMs: Date.now() - startedAt },
              });
              assistantMessageId = partialId;
            } else {
              const saved = await this.prisma.message.create({
                data: {
                  conversationId,
                  role: 'assistant',
                  content: accumulated,
                  model: gen.model,
                  status: 'stopped',
                  durationMs: Date.now() - startedAt,
                },
              });
              assistantMessageId = saved.id;
            }
          } catch (saveError) {
            this.logger.error(`save partial failed: ${saveError instanceof Error ? saveError.message : saveError}`);
          }
        }
        finished = true;
        sse({ type: 'done', conversationId, messageId: assistantMessageId, status: 'stopped' });
      } else {
        this.logger.error(`generation error user=${user.id} conv=${conversationId ?? '-'}: ${message}`);
        finished = true;
        sse({ type: 'error', message: message.slice(0, 300) });
      }
    } finally {
      subscription?.unsubscribe();
      const key = `${user.id}:${gen.conversationId}`;
      if (this.active.get(key) === gen) this.active.delete(key);
      this.gateway.releaseStream(gen.conversationId);
      res.end();
    }
  }

  // ---------- 内部工具 ----------

  private async defaultModel(): Promise<string> {
    const registryDefault = await this.gateway.getDefaultModel();
    if (registryDefault) return registryDefault.name;
    const def = await this.prisma.modelConfig.findFirst({
      where: { isDefault: true, enabled: true },
    });
    if (def) return def.name;
    const any = await this.prisma.modelConfig.findFirst({ where: { enabled: true }, orderBy: { sortOrder: 'asc' } });
    return any?.name ?? 'qwen3:8b';
  }
}
