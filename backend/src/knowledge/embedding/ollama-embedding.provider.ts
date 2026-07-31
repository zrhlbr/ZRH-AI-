import { BadRequestException } from '@nestjs/common';
import { IEmbeddingProvider, EmbeddingProviderHealth } from '../interfaces/embedding-provider.interface';

/**
 * Ollama Embedding Provider。
 * 默认使用 nomic-embed-text，维度 768。
 */
export class OllamaEmbeddingProvider implements IEmbeddingProvider {
  readonly code = 'ollama';
  readonly dimension = 768;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor() {
    this.baseUrl = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '');
    this.model = process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text';
    this.timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? '60000');
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
    return embeddings;
  }

  async health(): Promise<EmbeddingProviderHealth> {
    const started = Date.now();
    try {
      await this.embed('health check');
      return { status: 'online', latencyMs: Date.now() - started };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 'offline', error: message };
    }
  }
}
