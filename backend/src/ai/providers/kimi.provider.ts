import { Observable } from 'rxjs';
import { BaseProvider } from './base.provider';
import { AIMessage, AIGenerationOptions, AIStreamChunk, AIModelDescriptor, AIProviderHealth } from '../types/ai.types';

/**
 * Kimi Provider（预留实现）。
 */
export class KimiProvider extends BaseProvider {
  readonly code = 'kimi';

  constructor() {
    super(KimiProvider.name);
  }

  isEnabled(): boolean {
    return false;
  }

  async generate(): Promise<string> {
    throw new Error('Kimi provider not implemented in Stage 4');
  }

  stream(messages: AIMessage[], model: string, options?: AIGenerationOptions, context?: { conversationId?: number }): Observable<AIStreamChunk> {
    throw new Error('Kimi provider not implemented in Stage 4');
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
