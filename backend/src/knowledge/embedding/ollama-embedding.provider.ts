import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { IEmbeddingProvider, EmbeddingProviderHealth } from '../interfaces/embedding-provider.interface';

/**
 * Ollama Embedding Provider。
 * 默认使用 nomic-embed-text，维度 768。
 * 与 Stage 4 AI Gateway 独立：仅通过 OLLAMA_BASE_URL 复用宿主机 Ollama。
 */
@Injectable()
export class OllamaEmbeddingProvider implements IEmbeddingProvider {
  readonly code = 'ollama';
  readonly dimension = 768;
  private readonly logger = new Logger(OllamaEmbeddingProvider.name);
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor() {
    this.baseUrl = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '');
    this.model = process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text';
    this.timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? '60000');
    this.maxRetries = Math.max(0, Number(process.env.OLLAMA_EMBEDDING_RETRIES ?? '2'));
  }

  isEnabled(): boolean {
    return true;
  }

  async embed(text: string): Promise<number[]> {
    const result = await this.embedBatch([text]);
    return result[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const input = texts.map((t) => (t ?? '').trim() || ' ');
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.callEmbed(input);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.maxRetries) {
          const delayMs = 300 * (attempt + 1);
          this.logger.warn(`embed retry ${attempt + 1}/${this.maxRetries}: ${lastError.message}`);
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }
    throw lastError ?? new BadRequestException('ollama embed failed');
  }

  private async callEmbed(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new BadRequestException(`ollama embed failed HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    const data = (await response.json()) as { embeddings?: number[][] };
    const embeddings = data.embeddings ?? [];
    if (embeddings.length !== texts.length) {
      throw new BadRequestException('ollama embed returned unexpected count');
    }
    for (const vector of embeddings) {
      if (!Array.isArray(vector) || vector.length === 0) {
        throw new BadRequestException('ollama embed returned empty vector');
      }
    }
    return embeddings;
  }

  async health(): Promise<EmbeddingProviderHealth> {
    const started = Date.now();
    try {
      const tagsRes = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(Math.min(this.timeoutMs, 10000)),
      });
      if (!tagsRes.ok) {
        return { status: 'offline', error: `ollama tags HTTP ${tagsRes.status}` };
      }
      const tags = (await tagsRes.json()) as { models?: Array<{ name: string }> };
      const names = (tags.models ?? []).map((m) => m.name);
      const modelReady = names.some((n) => n === this.model || n.startsWith(`${this.model}:`));
      if (!modelReady) {
        return {
          status: 'offline',
          error: `embedding model not found: ${this.model}`,
          latencyMs: Date.now() - started,
        };
      }
      // 轻量探测：确认 embed API 可用
      await this.embed('health check');
      return { status: 'online', latencyMs: Date.now() - started };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 'offline', error: message, latencyMs: Date.now() - started };
    }
  }
}
