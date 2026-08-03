import { Observable } from 'rxjs';
import { BaseProvider } from './base.provider';
import {
  AIMessage,
  AIGenerationOptions,
  AIStreamChunk,
  AIModelDescriptor,
  AIProviderHealth,
} from '../types/ai.types';

/**
 * Optional Cursor Cloud Agent provider (official API only).
 * Disabled by default — local Developer Agent must work without Cursor quota.
 * Does not claim Cursor proprietary models/source/internals.
 *
 * Configure:
 *   CURSOR_CLOUD_ENABLED=true
 *   CURSOR_API_KEY=...
 *   CURSOR_API_BASE_URL=https://api.cursor.com  (optional)
 */
export class CursorCloudProvider extends BaseProvider {
  readonly code = 'cursor-cloud';

  constructor() {
    super(CursorCloudProvider.name);
  }

  private baseUrl(): string {
    return (process.env.CURSOR_API_BASE_URL || 'https://api.cursor.com').replace(/\/$/, '');
  }

  isEnabled(): boolean {
    return process.env.CURSOR_CLOUD_ENABLED === 'true' && !!process.env.CURSOR_API_KEY;
  }

  async generate(messages: AIMessage[], model: string): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('Cursor Cloud provider disabled (optional; local Developer Agent remains available)');
    }
    const key = process.env.CURSOR_API_KEY!;
    const res = await fetch(`${this.baseUrl()}/v0/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model || 'agent',
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Cursor Cloud API HTTP ${res.status}: ${text.slice(0, 240)}`);
    }
    const data = (await res.json()) as {
      output?: string;
      content?: string;
      message?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };
    return (
      data.output ||
      data.content ||
      data.message ||
      data.choices?.[0]?.message?.content ||
      JSON.stringify(data)
    );
  }

  stream(
    messages: AIMessage[],
    model: string,
    _options?: AIGenerationOptions,
    _context?: { conversationId?: number },
  ): Observable<AIStreamChunk> {
    return new Observable((sub) => {
      void this.generate(messages, model)
        .then((text) => {
          sub.next({ type: 'delta', content: text });
          sub.next({ type: 'done', content: '' });
          sub.complete();
        })
        .catch((err) => sub.error(err));
    });
  }

  stop(_conversationId?: number): boolean {
    return false;
  }

  async listModels(): Promise<AIModelDescriptor[]> {
    if (!this.isEnabled()) return [];
    return [{ name: 'agent', displayName: 'Cloud Agent (optional)', providerCode: this.code }];
  }

  async health(): Promise<AIProviderHealth> {
    if (!this.isEnabled()) {
      return { status: 'offline', error: 'disabled by default', checkedAt: new Date() };
    }
    try {
      const res = await fetch(`${this.baseUrl()}/v0/me`, {
        headers: { Authorization: `Bearer ${process.env.CURSOR_API_KEY}` },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        return { status: 'online', checkedAt: new Date() };
      }
      return { status: 'error', error: `HTTP ${res.status}`, checkedAt: new Date() };
    } catch (err) {
      return {
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
        checkedAt: new Date(),
      };
    }
  }
}
