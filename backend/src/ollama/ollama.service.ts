import { Injectable, Logger } from '@nestjs/common';
import { AIGatewayService } from '../ai/gateway/ai-gateway.service';

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
 * Ollama 兼容服务（阶段 4 已废弃直接调用）。
 * 所有请求统一转发到 AIGatewayService，由 Gateway 路由到 OllamaProvider。
 * 保留本服务仅为了兼容旧端点，未来移除。
 */
@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);

  constructor(private readonly gateway: AIGatewayService) {}

  async getStatus(): Promise<OllamaStatus> {
    const health = await this.gateway.checkProvider('ollama');
    return {
      status: health.status === 'online' ? 'online' : 'offline',
      baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
      latencyMs: health.latencyMs,
      error: health.error,
    };
  }

  async listModels(): Promise<{ status: 'online' | 'offline'; models: OllamaModelInfo[]; error?: string }> {
    const models = await this.gateway.listModels();
    const ollamaModels = models
      .filter((m) => m.providerCode === 'ollama')
      .map((m) => ({
        name: m.name,
        model: m.name,
        size: Number(m.sizeBytes ?? 0),
        modified_at: new Date().toISOString(),
        digest: m.digest ?? '',
      }));
    const health = await this.gateway.checkProvider('ollama');
    return {
      status: health.status === 'online' ? 'online' : 'offline',
      models: ollamaModels,
      error: health.error,
    };
  }
}
