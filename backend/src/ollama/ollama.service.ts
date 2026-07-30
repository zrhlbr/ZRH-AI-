import { Injectable, Logger } from '@nestjs/common';

export interface OllamaModelInfo {
  name: string;
  model: string;
  size: number;
  modified_at: string;
  digest: string;
}

export interface OllamaStatus {
  status: 'online' | 'offline';
  baseUrl: string;
  latencyMs?: number;
  error?: string;
}

/**
 * Ollama 后端代理服务。
 * 前端永远不直接访问 11434，统一经由本服务转发；
 * 所有请求带超时，Ollama 离线时返回明确状态而不抛异常。
 */
@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs = 5000;

  constructor() {
    this.baseUrl = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '');
  }

  private async fetchJson<T>(path: string): Promise<{ ok: true; data: T; latencyMs: number } | { ok: false; error: string }> {
    const started = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) {
        return { ok: false, error: `HTTP ${response.status}` };
      }
      const data = (await response.json()) as T;
      return { ok: true, data, latencyMs: Date.now() - started };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Ollama request ${path} failed: ${message}`);
      return { ok: false, error: message };
    }
  }

  async getStatus(): Promise<OllamaStatus> {
    const result = await this.fetchJson<{ models?: unknown[] }>('/api/tags');
    if (result.ok) {
      return { status: 'online', baseUrl: this.baseUrl, latencyMs: result.latencyMs };
    }
    return { status: 'offline', baseUrl: this.baseUrl, error: result.error };
  }

  async listModels(): Promise<{ status: 'online' | 'offline'; models: OllamaModelInfo[]; error?: string }> {
    const result = await this.fetchJson<{ models?: OllamaModelInfo[] }>('/api/tags');
    if (!result.ok) {
      return { status: 'offline', models: [], error: result.error };
    }
    const models = Array.isArray(result.data.models) ? result.data.models : [];
    return { status: 'online', models };
  }
}
