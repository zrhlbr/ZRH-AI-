import { Observable } from 'rxjs';
import { BaseProvider } from './base.provider';
import { AIMessage, AIGenerationOptions, AIStreamChunk, AIModelDescriptor, AIProviderHealth } from '../types/ai.types';

/**
 * Mock Provider：仅用于测试与 CI，不发起真实网络请求。
 * 阶段 4 明确禁止业务使用 Mock 替代真实 Ollama。
 */
export class MockProvider extends BaseProvider {
  readonly code = 'mock';
  private readonly responses = new Map<string, string>();
  private enabled = false;

  constructor() {
    super(MockProvider.name);
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
  }

  setResponse(model: string, response: string): void {
    this.responses.set(model, response);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async generate(messages: AIMessage[], model: string): Promise<string> {
    return this.responses.get(model) ?? `[MOCK] ${model}: ${messages[messages.length - 1]?.content ?? ''}`;
  }

  stream(
    messages: AIMessage[],
    model: string,
    options?: AIGenerationOptions,
    context?: { conversationId?: number },
  ): Observable<AIStreamChunk> {
    const text = this.responses.get(model) ?? `[MOCK] ${model}: ${messages[messages.length - 1]?.content ?? ''}`;
    const chunks = text.split('');
    return new Observable<AIStreamChunk>((subscriber) => {
      let i = 0;
      const timer = setInterval(() => {
        if (i < chunks.length) {
          subscriber.next({ type: 'delta', content: chunks[i] });
          i++;
        } else {
          subscriber.next({
            type: 'done',
            promptTokens: 1,
            completionTokens: chunks.length,
            durationMs: chunks.length * 10,
          });
          subscriber.complete();
          clearInterval(timer);
        }
      }, 10);
      return () => clearInterval(timer);
    });
  }

  stop(): boolean {
    return false;
  }

  async listModels(): Promise<AIModelDescriptor[]> {
    if (!this.enabled) return [];
    return [
      {
        name: 'mock-model',
        displayName: 'Mock Model',
        providerCode: this.code,
        status: 'online',
        enabled: true,
        isDefault: false,
        contextLength: 4096,
        capabilities: [],
      },
    ];
  }

  async health(): Promise<AIProviderHealth> {
    return {
      status: this.enabled ? 'online' : 'offline',
      checkedAt: new Date(),
    };
  }
}
