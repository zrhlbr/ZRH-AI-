import { Observable } from 'rxjs';
import { BaseProvider } from './base.provider';
import { AIMessage, AIGenerationOptions, AIStreamChunk, AIModelDescriptor, AIProviderHealth } from '../types/ai.types';

/**
 * vLLM Provider（预留实现）。
 */
export class VLLMProvider extends BaseProvider {
  readonly code = 'vllm';

  constructor() {
    super(VLLMProvider.name);
  }

  isEnabled(): boolean {
    return false;
  }

  async generate(): Promise<string> {
    throw new Error('vLLM provider not implemented in Stage 4');
  }

  stream(messages: AIMessage[], model: string, options?: AIGenerationOptions, context?: { conversationId?: number }): Observable<AIStreamChunk> {
    throw new Error('vLLM provider not implemented in Stage 4');
  }

  stop(): boolean {
    return false;
  }

  async listModels(): Promise<AIModelDescriptor[]> {
    return [];
  }

  async health(): Promise<AIProviderHealth> {
    return { status: 'offline', error: 'not implemented', checkedAt: new Date() };
  }
}
