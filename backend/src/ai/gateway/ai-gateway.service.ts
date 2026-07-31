import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import {
  AIProvider,
  AIModel,
  AIModelCapability,
  ModelCapability,
  ModelHealth,
  PromptTemplate,
} from '@prisma/client';
import { IAIProvider } from '../interfaces/ai-provider.interface';
import {
  AIMessage,
  AIGenerationOptions,
  AIStreamChunk,
  AIModelDescriptor,
  AIProviderHealth,
} from '../types/ai.types';
import { ModelRegistryService } from '../registry/model-registry.service';
import { ModelRouterService } from '../router/model-router.service';
import { StreamingManagerService } from '../stream/streaming-manager.service';
import { PromptManagerService } from '../prompt/prompt-manager.service';
import { AIHealthService } from '../health/ai-health.service';
import {
  OllamaProvider,
  OpenAIProvider,
  ClaudeProvider,
  GeminiProvider,
  KimiProvider,
  VLLMProvider,
  SGLangProvider,
  MockProvider,
} from '../providers';

interface ActiveStream {
  providerCode: string;
  modelName: string;
  subscription?: { unsubscribe: () => void };
}

/**
 * AI Gateway：所有 AI 调用的唯一入口。
 * 禁止任何业务模块直接调用 Ollama 或具体 Provider。
 */
@Injectable()
export class AIGatewayService {
  private readonly logger = new Logger(AIGatewayService.name);
  private readonly providers = new Map<string, IAIProvider>();
  private readonly activeStreams = new Map<number, ActiveStream>();

  constructor(
    private readonly registry: ModelRegistryService,
    private readonly router: ModelRouterService,
    private readonly streaming: StreamingManagerService,
    private readonly prompts: PromptManagerService,
    private readonly health: AIHealthService,
  ) {
    // 注册所有 Provider
    this.register(new OllamaProvider());
    this.register(new OpenAIProvider());
    this.register(new ClaudeProvider());
    this.register(new GeminiProvider());
    this.register(new KimiProvider());
    this.register(new VLLMProvider());
    this.register(new SGLangProvider());
    this.register(new MockProvider());
  }

  private register(provider: IAIProvider): void {
    this.providers.set(provider.code, provider);
  }

  getProvider(code: string): IAIProvider | undefined {
    return this.providers.get(code);
  }

  getProviders(): IAIProvider[] {
    return Array.from(this.providers.values());
  }

  /** 同步指定 Provider 的模型清单到 Registry */
  async syncProvider(code: string) {
    const provider = this.getProvider(code);
    if (!provider) throw new BadRequestException(`provider not found: ${code}`);
    return this.registry.syncFromProvider(provider);
  }

  /** 列出所有 Registry 模型（与 Provider 状态合并） */
  async listModels(): Promise<AIModelDescriptor[]> {
    return this.registry.listModels(this.getProviders());
  }

  /** 获取默认模型 */
  async getDefaultModel(): Promise<AIModelDescriptor | null> {
    return this.registry.getDefaultModel();
  }

  /** 设置默认模型 */
  async setDefaultModel(providerCode: string, name: string) {
    return this.registry.setDefaultModel(providerCode, name);
  }

  /** 启用/禁用模型 */
  async setModelEnabled(providerCode: string, name: string, enabled: boolean) {
    return this.registry.setModelEnabled(providerCode, name, enabled);
  }

  /** 统一路由决策 */
  async route(prompt: string, preferredModel?: string) {
    return this.router.route(prompt, preferredModel);
  }

  /** 解析 System Prompt */
  async resolveSystemPrompt(custom?: string | null, promptCode?: string | null): Promise<string | null> {
    return this.prompts.resolveSystemPrompt(custom, promptCode);
  }

  /** 列出 Prompt 模板 */
  async listPrompts(): Promise<PromptTemplate[]> {
    return this.prompts.listPrompts();
  }

  /** 非流式生成（预留） */
  async generate(messages: AIMessage[], modelRef?: string): Promise<string> {
    const decision = await this.route(messages[messages.length - 1]?.content ?? '', modelRef);
    const provider = this.getProvider(decision.providerCode);
    if (!provider) throw new BadRequestException(`provider not found: ${decision.providerCode}`);
    return provider.generate(messages, decision.modelName);
  }

  /**
   * 流式生成：核心入口。
   * 返回 Observable<AIStreamChunk>，调用方负责订阅与持久化。
   */
  async stream(
    messages: AIMessage[],
    options: AIGenerationOptions & { conversationId?: number; modelRef?: string } = {},
  ): Promise<{ providerCode: string; modelName: string; stream: Observable<AIStreamChunk> }> {
    const { conversationId, modelRef, ...generationOptions } = options;
    const decision = await this.route(messages[messages.length - 1]?.content ?? '', modelRef);
    const provider = this.getProvider(decision.providerCode);
    if (!provider) throw new BadRequestException(`provider not found: ${decision.providerCode}`);

    this.logger.log(`gateway stream provider=${decision.providerCode} model=${decision.modelName} conv=${conversationId ?? '-'}`);
    const stream = provider.stream(messages, decision.modelName, generationOptions, { conversationId });

    if (conversationId !== undefined) {
      this.activeStreams.set(conversationId, { providerCode: decision.providerCode, modelName: decision.modelName });
    }

    return { providerCode: decision.providerCode, modelName: decision.modelName, stream };
  }

  /** 停止指定对话的流式生成 */
  stop(conversationId: number): boolean {
    const active = this.activeStreams.get(conversationId);
    if (!active) return false;
    const provider = this.getProvider(active.providerCode);
    const stopped = provider?.stop(conversationId) ?? false;
    this.activeStreams.delete(conversationId);
    this.logger.log(`gateway stop conv=${conversationId} provider=${active.providerCode} stopped=${stopped}`);
    return stopped;
  }

  /** 将 Provider 流直接写入 Express SSE Response */
  async streamToResponse(
    stream: Observable<AIStreamChunk>,
    res: Response,
    onChunk?: (chunk: AIStreamChunk) => void,
  ): Promise<void> {
    this.streaming.setupSSE(res);
    return this.streaming.pipeToResponse(stream, res, onChunk);
  }

  /** Provider 健康检查 */
  async checkProvider(code: string): Promise<AIProviderHealth> {
    const provider = this.getProvider(code);
    if (!provider) throw new BadRequestException(`provider not found: ${code}`);
    return this.health.checkProvider(provider);
  }

  /** 模型健康检查 */
  async checkModel(providerCode: string, modelName: string) {
    const provider = this.getProvider(providerCode);
    if (!provider) throw new BadRequestException(`provider not found: ${providerCode}`);
    return this.health.checkModel(provider, modelName);
  }

  /** 批量健康检查 */
  async checkAll(models?: { providerCode: string; name: string }[]) {
    return this.health.checkAll(this.getProviders(), models);
  }

  /** 拉取模型（Ollama 支持） */
  pullModel(providerCode: string, modelName: string) {
    const provider = this.getProvider(providerCode);
    if (!provider) throw new BadRequestException(`provider not found: ${providerCode}`);
    if (!provider.pullModel) throw new BadRequestException(`provider ${providerCode} does not support pullModel`);
    return provider.pullModel(modelName);
  }

  /** 删除模型（Ollama 支持） */
  async deleteModel(providerCode: string, modelName: string): Promise<boolean> {
    const provider = this.getProvider(providerCode);
    if (!provider) throw new BadRequestException(`provider not found: ${providerCode}`);
    if (!provider.deleteModel) throw new BadRequestException(`provider ${providerCode} does not support deleteModel`);
    return provider.deleteModel(modelName);
  }

  /** 模型详情（Ollama 支持） */
  async showModel(providerCode: string, modelName: string): Promise<Record<string, unknown>> {
    const provider = this.getProvider(providerCode);
    if (!provider) throw new BadRequestException(`provider not found: ${providerCode}`);
    if (!provider.showModel) throw new BadRequestException(`provider ${providerCode} does not support showModel`);
    return provider.showModel(modelName);
  }

  /** 已载入显存的模型（Ollama ps） */
  async loadedModels(providerCode: string) {
    const provider = this.getProvider(providerCode);
    if (!provider || provider.code !== 'ollama') return [];
    return (provider as OllamaProvider).loadedModels();
  }

  /** 清理已结束流 */
  releaseStream(conversationId: number): void {
    this.activeStreams.delete(conversationId);
  }
}
