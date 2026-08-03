import { BadRequestException } from '@nestjs/common';
import { Observable, Subscriber } from 'rxjs';
import { BaseProvider } from './base.provider';
import {
  AIMessage,
  AIGenerationOptions,
  AIStreamChunk,
  AIModelDescriptor,
  AIProviderHealth,
  AIPullProgress,
} from '../types/ai.types';

interface OllamaChatChunk {
  message?: { role?: string; content?: string };
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  error?: string;
}

interface OllamaTagModel {
  name: string;
  model?: string;
  size?: number;
  digest?: string;
  modified_at?: string;
  details?: Record<string, unknown>;
}

/**
 * Ollama Provider：直接调用本地/远端 Ollama HTTP API。
 * 所有聊天请求必须经 AIGatewayService 路由至此，禁止业务代码直接实例化。
 */
export class OllamaProvider extends BaseProvider {
  readonly code = 'ollama';
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly active = new Map<number, AbortController>();

  private readonly streamTimeoutMs: number;

  constructor() {
    super(OllamaProvider.name);
    this.baseUrl = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '');
    this.timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? '60000');
    this.streamTimeoutMs = Number(process.env.OLLAMA_STREAM_TIMEOUT_MS ?? '300000');
  }

  isEnabled(): boolean {
    return true;
  }

  private async fetchJson<T>(path: string, init?: RequestInit): Promise<{ ok: true; data: T; latencyMs: number } | { ok: false; error: string }> {
    const started = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
      }
      const data = (await response.json()) as T;
      return { ok: true, data, latencyMs: Date.now() - started };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Ollama ${path} failed: ${message}`);
      return { ok: false, error: message };
    }
  }

  private buildBody(messages: AIMessage[], model: string, options?: AIGenerationOptions) {
    return {
      model,
      stream: true,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      options: {
        temperature: options?.temperature,
        top_p: options?.topP,
        top_k: options?.topK,
        repeat_penalty: options?.repeatPenalty,
        num_ctx: options?.contextLength,
        num_predict: options?.maxTokens,
        ...(options?.seed !== null && options?.seed !== undefined ? { seed: options.seed } : {}),
        ...(options?.stop ? { stop: options.stop } : {}),
      },
    };
  }

  async generate(messages: AIMessage[], model: string, options?: AIGenerationOptions): Promise<string> {
    const result = await this.fetchJson<{ message?: { content?: string }; done?: boolean; error?: string }>('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.buildBody(messages, model, options), stream: false }),
    });
    if (!result.ok) throw new BadRequestException(`ollama generate failed: ${result.error}`);
    if (result.data.error) throw new BadRequestException(`ollama: ${result.data.error}`);
    return result.data.message?.content ?? '';
  }

  stream(
    messages: AIMessage[],
    model: string,
    options?: AIGenerationOptions,
    context?: { conversationId?: number },
  ): Observable<AIStreamChunk> {
    return new Observable<AIStreamChunk>((subscriber: Subscriber<AIStreamChunk>) => {
      const controller = new AbortController();
      const key = context?.conversationId ?? -Date.now();
      this.active.set(key, controller);

      const cleanup = () => {
        this.active.delete(key);
        for (const [k, c] of this.active.entries()) {
          if (c === controller) this.active.delete(k);
        }
      };

      const run = async () => {
        // Stabilization R2: hard timeout for streaming generations
        let timedOut = false;
        const streamTimer = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, Math.max(10000, this.streamTimeoutMs || 300000));
        try {
          const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify(this.buildBody(messages, model, options)),
          });

          if (!response.ok || !response.body) {
            const text = await response.text().catch(() => '');
            throw new BadRequestException(`ollama error HTTP ${response.status}: ${text.slice(0, 200)}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

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
              // 仅输出正式 content；thinking/reasoning 阶段由 Ollama 内部处理，不暴露给用户
              if (delta) {
                subscriber.next({ type: 'delta', content: delta });
              }
              if (chunk.done) {
                subscriber.next({
                  type: 'done',
                  ...this.buildUsage(chunk.prompt_eval_count, chunk.eval_count, chunk.total_duration),
                });
              }
            }
          }
          subscriber.complete();
        } catch (error) {
          if (controller.signal.aborted) {
            if (timedOut) {
              subscriber.next({ type: 'error', message: 'stream timeout' });
            } else {
              subscriber.next({ type: 'done' });
            }
            subscriber.complete();
          } else {
            const message = error instanceof Error ? error.message : String(error);
            subscriber.next({ type: 'error', message: message.slice(0, 300) });
            subscriber.complete();
          }
        } finally {
          clearTimeout(streamTimer);
          cleanup();
        }
      };

      run();

      return () => {
        controller.abort();
        cleanup();
      };
    });
  }

  stop(conversationId: number): boolean {
    const controller = this.active.get(conversationId);
    if (!controller) return false;
    controller.abort();
    this.active.delete(conversationId);
    this.logger.log(`ollama generation stopped conv=${conversationId}`);
    return true;
  }

  async listModels(): Promise<AIModelDescriptor[]> {
    const result = await this.fetchJson<{ models?: OllamaTagModel[] }>('/api/tags');
    if (!result.ok) return [];
    return (result.data.models ?? []).map((m) => ({
      name: m.name,
      displayName: m.name,
      providerCode: this.code,
      sizeBytes: m.size ?? null,
      digest: m.digest ?? null,
      status: 'online',
      enabled: true,
      isDefault: false,
      contextLength: 8192,
      capabilities: [],
    }));
  }

  async health(model?: string): Promise<AIProviderHealth> {
    const started = Date.now();
    const result = await this.fetchJson<{ models?: unknown[] }>('/api/tags');
    if (!result.ok) {
      return { status: 'offline', error: result.error, checkedAt: new Date() };
    }
    if (model) {
      const installed = (result.data.models ?? []).some((m: unknown) =>
        typeof m === 'object' && m !== null && (m as OllamaTagModel).name === model,
      );
      if (!installed) {
        return { status: 'error', error: `model ${model} not installed`, checkedAt: new Date(), latencyMs: result.latencyMs };
      }
    }
    return { status: 'online', latencyMs: Date.now() - started, checkedAt: new Date() };
  }

  pullModel(model: string): Observable<AIPullProgress> {
    return new Observable<AIPullProgress>((subscriber) => {
      const controller = new AbortController();
      const run = async () => {
        try {
          const response = await fetch(`${this.baseUrl}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({ name: model, stream: true }),
          });
          if (!response.ok || !response.body) {
            const text = await response.text().catch(() => '');
            subscriber.next({ status: 'error', error: `HTTP ${response.status}: ${text.slice(0, 200)}` });
            subscriber.complete();
            return;
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              let chunk: { status?: string; completed?: number; total?: number; digest?: string; error?: string };
              try {
                chunk = JSON.parse(trimmed);
              } catch {
                continue;
              }
              if (chunk.error) {
                subscriber.next({ status: 'error', error: chunk.error });
                subscriber.complete();
                return;
              }
              subscriber.next({
                status: chunk.status === 'success' ? 'complete' : 'pulling',
                completed: chunk.completed,
                total: chunk.total,
                digest: chunk.digest,
              });
            }
          }
          subscriber.next({ status: 'complete' });
          subscriber.complete();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          subscriber.next({ status: 'error', error: message });
          subscriber.complete();
        }
      };
      run();
      return () => controller.abort();
    });
  }

  async deleteModel(model: string): Promise<boolean> {
    const result = await this.fetchJson<{ deleted?: boolean }>('/api/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model }),
    });
    return result.ok;
  }

  async showModel(model: string): Promise<Record<string, unknown>> {
    const result = await this.fetchJson<Record<string, unknown>>('/api/show', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model }),
    });
    if (!result.ok) throw new BadRequestException(`ollama show failed: ${result.error}`);
    return result.data;
  }

  /** 获取 Ollama 当前已载入显存的模型列表 */
  async loadedModels(): Promise<Array<{ name: string; sizeVram?: number | null; expiresAt?: string | null }>> {
    const result = await this.fetchJson<{ models?: Array<{ name: string; size_vram?: number; expires_at?: string }> }>('/api/ps');
    if (!result.ok) return [];
    return (result.data.models ?? []).map((m) => ({
      name: m.name,
      sizeVram: m.size_vram ?? null,
      expiresAt: m.expires_at ?? null,
    }));
  }
}
