import { Observable } from 'rxjs';
import {
  AIMessage,
  AIGenerationOptions,
  AIStreamChunk,
  AIUsage,
  AIModelDescriptor,
  AIProviderHealth,
  AIPullProgress,
} from '../types/ai.types';

/**
 * 所有 AI Provider 必须实现的统一接口。
 * 禁止任何业务模块直接调用具体 Provider，统一通过 AIGatewayService 访问。
 */
export interface IAIProvider {
  /** Provider 唯一标识，如 ollama / openai / claude */
  readonly code: string;

  /** 是否已启用 */
  isEnabled(): boolean;

  /** 同步生成（预留：非流式场景） */
  generate(messages: AIMessage[], model: string, options?: AIGenerationOptions): Promise<string>;

  /**
   * 流式生成。
   * 返回 RxJS Observable，每个元素为 AIStreamChunk。
   * 调用方负责订阅并在 onComplete 时持久化。
   * @param context 流式上下文，用于 stop() 按 conversationId 中止。
   */
  stream(
    messages: AIMessage[],
    model: string,
    options?: AIGenerationOptions,
    context?: { conversationId?: number },
  ): Observable<AIStreamChunk>;

  /** 中止指定对话的流式生成 */
  stop(conversationId: number): boolean;

  /** 列出该 Provider 可用模型 */
  listModels(): Promise<AIModelDescriptor[]>;

  /** Provider / 指定模型健康检查 */
  health(model?: string): Promise<AIProviderHealth>;

  /** 拉取/安装模型（Ollama 等支持） */
  pullModel?(model: string): Observable<AIPullProgress>;

  /** 删除本地模型（Ollama 等支持） */
  deleteModel?(model: string): Promise<boolean>;

  /** 模型详情（Ollama show 等） */
  showModel?(model: string): Promise<Record<string, unknown>>;

  /** 文本嵌入（预留） */
  embeddings?(texts: string[], model: string): Promise<number[][]>;

  /** 工具调用（预留） */
  toolCall?(messages: AIMessage[], model: string, tools: unknown[]): Promise<unknown>;
}

export const IAI_PROVIDER = Symbol('IAI_PROVIDER');
