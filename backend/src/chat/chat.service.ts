import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import {
  ConversationListQueryDto,
  MessagesQueryDto,
  SendMessageDto,
  UpdateConversationDto,
  UpdateMessageDto,
  UpdateParamsDto,
} from './dto/chat.dto';

interface ActiveGeneration {
  controller: AbortController;
  conversationId: number;
  model: string;
  stoppedByUser: boolean;
}

interface OllamaChatChunk {
  message?: { role?: string; content?: string };
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  error?: string;
}

const HISTORY_LIMIT = 30;
const CONTINUE_HINT = 'continue';

/**
 * AI 对话核心服务（阶段 3）
 * - 所有 AI 回复真实调用本地 Ollama，禁止任何模拟数据
 * - SSE / Chunk Streaming 逐字输出，支持停止 / 继续 / 重新生成
 * - 日志只记录事件（开始/停止/切换/异常），不记录消息内容
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly ollamaBase = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '');
  /** 进行中的生成：key = `${userId}:${conversationId}` */
  private readonly active = new Map<string, ActiveGeneration>();

  constructor(private readonly prisma: PrismaService) {}

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
      // 模型切换：新消息走新模型，旧消息保留各自 model 字段
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
    const [configs, tags] = await Promise.all([
      this.prisma.modelConfig.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.fetchOllama<{ models?: Array<{ name: string; size: number; digest: string }> }>('/api/tags'),
    ]);
    const installed = new Map((tags?.models ?? []).map((m) => [m.name, m]));
    return {
      ollama: tags ? 'online' : 'offline',
      models: configs.map((c) => ({
        name: c.name,
        displayName: c.displayName,
        enabled: c.enabled,
        isDefault: c.isDefault,
        installed: installed.has(c.name),
        sizeBytes: installed.get(c.name)?.size ?? null,
      })),
    };
  }

  async modelsStatus() {
    const [configs, tags, ps] = await Promise.all([
      this.prisma.modelConfig.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.fetchOllama<{ models?: Array<{ name: string }> }>('/api/tags'),
      this.fetchOllama<{ models?: Array<{ name: string; size_vram?: number; expires_at?: string }> }>('/api/ps'),
    ]);
    if (!tags) {
      return {
        ollama: 'offline',
        models: configs.map((c) => ({ name: c.name, displayName: c.displayName, status: 'error' as const })),
      };
    }
    const installed = new Set((tags.models ?? []).map((m) => m.name));
    const loaded = new Map((ps?.models ?? []).map((m) => [m.name, m]));
    const generatingModels = new Set([...this.active.values()].map((a) => a.model));
    return {
      ollama: 'online',
      models: configs.map((c) => {
        let status: 'online' | 'loading' | 'running' | 'stopped' | 'error';
        if (!c.enabled) status = 'stopped';
        else if (!installed.has(c.name)) status = 'stopped';
        else if (generatingModels.has(c.name)) status = 'running';
        else if (loaded.has(c.name)) status = 'online';
        else status = 'loading'; // 已安装未载入显存，首次请求时加载
        return {
          name: c.name,
          displayName: c.displayName,
          status,
          installed: installed.has(c.name),
          vramBytes: loaded.get(c.name)?.size_vram ?? null,
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
    return this.prisma.promptTemplate.findMany({ orderBy: [{ role: 'asc' }, { id: 'asc' }] });
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
    gen.controller.abort();
    this.logger.log(`generation stopped by user=${userId} conv=${conversationId}`);
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
    const startedAt = Date.now();
    const gen: ActiveGeneration = {
      controller: new AbortController(),
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
        // 模型切换：会话记新模型，历史消息保留旧模型字段
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
        recent.push({ ...last, id: -1, role: 'user', content: CONTINUE_HINT });
        sse({ type: 'meta', conversationId: conversation.id, appendToMessageId, model });
      } else {
        // regenerate：删除最后一条 assistant 后重新生成
        const last = recent[recent.length - 1];
        if (!last || last.role !== 'assistant') {
          throw new BadRequestException('nothing to regenerate');
        }
        await this.prisma.message.delete({ where: { id: last.id } });
        recent.pop();
        sse({ type: 'meta', conversationId: conversation.id, replacedMessageId: last.id, model });
      }

      // 3. System Prompt：会话自定义 → 模板 → 默认模板
      const systemPrompt = await this.resolveSystemPrompt(conversation.systemPrompt, dto.promptCode ?? conversation.promptCode);

      // 4. 生成参数（数据库持久化）
      const params = await this.getParams(user.id);

      // 5. 调用 Ollama（真实调用，流式）
      const key = `${user.id}:${conversation.id}`;
      this.active.get(key)?.controller.abort();
      this.active.set(key, gen);
      req.on('close', () => {
        if (!finished) {
          gen.stoppedByUser = true;
          gen.controller.abort();
        }
      });

      this.logger.log(`generation start user=${user.id} conv=${conversation.id} model=${model} mode=${mode}`);
      const ollamaRes = await fetch(`${this.ollamaBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: gen.controller.signal,
        body: JSON.stringify({
          model,
          stream: true,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            ...recent.map((m) => ({ role: m.role, content: m.content })),
          ],
          options: {
            temperature: params.temperature,
            top_p: params.topP,
            top_k: params.topK,
            repeat_penalty: params.repeatPenalty,
            num_ctx: params.contextLength,
            num_predict: params.maxTokens,
            ...(params.seed !== null && params.seed !== undefined ? { seed: params.seed } : {}),
          },
        }),
      });

      if (!ollamaRes.ok || !ollamaRes.body) {
        const text = await ollamaRes.text().catch(() => '');
        throw new BadRequestException(`ollama error HTTP ${ollamaRes.status}: ${text.slice(0, 200)}`);
      }

      // 6. 逐 chunk 解析 NDJSON 并转发
      const reader = ollamaRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let usage: { promptTokens: number | null; completionTokens: number | null; durationMs: number | null } = {
        promptTokens: null,
        completionTokens: null,
        durationMs: null,
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let chunk: OllamaChatChunk;
          try {
            chunk = JSON.parse(trimmed) as OllamaChatChunk;
          } catch {
            continue;
          }
          if (chunk.error) throw new BadRequestException(`ollama: ${chunk.error}`);
          const delta = chunk.message?.content ?? '';
          if (delta) {
            accumulated += delta;
            sse({ type: 'delta', content: delta });
          }
          if (chunk.done) {
            usage = {
              promptTokens: chunk.prompt_eval_count ?? null,
              completionTokens: chunk.eval_count ?? null,
              durationMs: chunk.total_duration ? Math.round(chunk.total_duration / 1e6) : null,
            };
          }
        }
      }

      // 7. 持久化 assistant 消息
      const status = gen.stoppedByUser ? 'stopped' : 'done';
      if (appendToMessageId) {
        await this.prisma.message.update({
          where: { id: appendToMessageId },
          data: {
            content: accumulated,
            status,
            durationMs: usage.durationMs ?? Date.now() - startedAt,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
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
            durationMs: usage.durationMs ?? Date.now() - startedAt,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
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
        ...usage,
      });
      this.logger.log(
        `generation ${status} user=${user.id} conv=${conversation.id} model=${model} durationMs=${usage.durationMs ?? Date.now() - startedAt}`,
      );
    } catch (error) {
      const isAbort = gen.controller.signal.aborted;
      const message = error instanceof Error ? error.message : String(error);
      if (isAbort) {
        // 客户端断开 / 主动停止：保存已生成部分
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
      const key = `${user.id}:${gen.conversationId}`;
      if (this.active.get(key) === gen) this.active.delete(key);
      res.end();
    }
  }

  // ---------- 内部工具 ----------

  private async defaultModel(): Promise<string> {
    const def = await this.prisma.modelConfig.findFirst({
      where: { isDefault: true, enabled: true },
    });
    if (def) return def.name;
    const any = await this.prisma.modelConfig.findFirst({ where: { enabled: true }, orderBy: { sortOrder: 'asc' } });
    return any?.name ?? 'qwen3:8b';
  }

  private async resolveSystemPrompt(custom: string | null, promptCode: string | null): Promise<string | null> {
    if (custom) return custom;
    if (promptCode) {
      const tpl = await this.prisma.promptTemplate.findUnique({ where: { code: promptCode } });
      if (tpl) return tpl.content;
    }
    const def = await this.prisma.promptTemplate.findFirst({ where: { isDefault: true, role: 'system' } });
    return def?.content ?? null;
  }

  private async fetchOllama<T>(path: string): Promise<T | null> {
    try {
      const response = await fetch(`${this.ollamaBase}${path}`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) return null;
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }
}
