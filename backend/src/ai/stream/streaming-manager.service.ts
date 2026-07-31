import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { Observable, Subscription } from 'rxjs';
import { AIStreamChunk } from '../types/ai.types';

/**
 * Streaming Manager：统一将 Provider 的 Observable<AIStreamChunk> 写入 Express SSE 响应。
 * 禁止任何 Provider 直接操作 HTTP Response。
 */
@Injectable()
export class StreamingManagerService {
  private readonly logger = new Logger(StreamingManagerService.name);

  /**
   * 初始化 SSE 响应头。
   */
  setupSSE(res: Response): void {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
  }

  /**
   * 发送单个 SSE 事件。
   */
  send(res: Response, payload: Record<string, unknown>): void {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  /**
   * 订阅 Provider 流并转发到 Response。
   * @returns Promise 在流完成/出错/中止时 resolve
   */
  pipeToResponse(
    stream: Observable<AIStreamChunk>,
    res: Response,
    onChunk?: (chunk: AIStreamChunk) => void,
  ): Promise<void> {
    return new Promise((resolve) => {
      let subscription: Subscription | undefined;

      const finish = () => {
        if (!res.writableEnded) res.end();
        resolve();
      };

      subscription = stream.subscribe({
        next: (chunk) => {
          if (chunk.type === 'delta') {
            this.send(res, { type: 'delta', content: chunk.content });
          } else if (chunk.type === 'done') {
            this.send(res, {
              type: 'done',
              promptTokens: chunk.promptTokens ?? null,
              completionTokens: chunk.completionTokens ?? null,
              durationMs: chunk.durationMs ?? null,
            });
          } else if (chunk.type === 'error') {
            this.send(res, { type: 'error', message: chunk.message });
          }
          onChunk?.(chunk);
        },
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`stream error: ${message}`);
          this.send(res, { type: 'error', message: message.slice(0, 300) });
          finish();
        },
        complete: () => {
          finish();
        },
      });

      res.on('close', () => {
        subscription?.unsubscribe();
        finish();
      });
    });
  }
}
