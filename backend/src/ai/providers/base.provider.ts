import { Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { IAIProvider } from '../interfaces/ai-provider.interface';
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
 * Provider 抽象基类：提供通用辅助方法，子类只需实现核心能力。
 */
export abstract class BaseProvider implements IAIProvider {
  protected readonly logger: Logger;
  abstract readonly code: string;

  protected constructor(loggerName: string) {
    this.logger = new Logger(loggerName);
  }

  isEnabled(): boolean {
    return true;
  }

  abstract generate(messages: AIMessage[], model: string, options?: AIGenerationOptions): Promise<string>;

  abstract stream(
    messages: AIMessage[],
    model: string,
    options?: AIGenerationOptions,
  ): Observable<AIStreamChunk>;

  abstract stop(conversationId: number): boolean;

  abstract listModels(): Promise<AIModelDescriptor[]>;

  abstract health(model?: string): Promise<AIProviderHealth>;

  protected buildUsage(
    promptTokens?: number | null,
    completionTokens?: number | null,
    durationNs?: number | null,
  ): AIUsage {
    return {
      promptTokens: promptTokens ?? null,
      completionTokens: completionTokens ?? null,
      durationMs: durationNs ? Math.round(durationNs / 1e6) : null,
    };
  }

  /** 默认不支持 pullModel */
  pullModel?(model: string): Observable<AIPullProgress>;

  /** 默认不支持 deleteModel */
  async deleteModel?(model: string): Promise<boolean> {
    throw new Error(`deleteModel not supported by ${this.code}`);
  }

  /** 默认不支持 showModel */
  async showModel?(model: string): Promise<Record<string, unknown>> {
    throw new Error(`showModel not supported by ${this.code}`);
  }

  /** 默认不支持 embeddings */
  async embeddings?(texts: string[], model: string): Promise<number[][]> {
    throw new Error(`embeddings not supported by ${this.code}`);
  }

  /** 默认不支持 toolCall */
  async toolCall?(messages: AIMessage[], model: string, tools: unknown[]): Promise<unknown> {
    throw new Error(`toolCall not supported by ${this.code}`);
  }
}
