import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DocumentService } from '../../knowledge/documents/document.service';
import { EmbeddingTaskService } from '../../knowledge/tasks/embedding-task.service';

/**
 * Stage 6 Embedding Worker：后台轮询 pending 任务，执行 Embedding / Index / Rebuild。
 */
@Injectable()
export class EmbeddingWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmbeddingWorkerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly tasks: EmbeddingTaskService,
    private readonly documents: DocumentService,
  ) {}

  onModuleInit() {
    const enabled = (process.env.RAG_EMBEDDING_WORKER ?? 'true').toLowerCase() !== 'false';
    if (!enabled) {
      this.logger.warn('Embedding worker disabled by RAG_EMBEDDING_WORKER=false');
      return;
    }
    const intervalMs = Math.max(1000, Number(process.env.RAG_EMBEDDING_WORKER_MS ?? '3000'));
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.logger.log(`Embedding worker started interval=${intervalMs}ms`);
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const batch = Math.max(1, Number(process.env.RAG_EMBEDDING_WORKER_BATCH ?? '2'));
      // Stabilization R2: atomic claim + stale recovery
      const claimed = await this.tasks.claimPending(batch);
      for (const task of claimed) {
        try {
          const result = await this.documents.processEmbeddingTask(task.id);
          this.logger.log(`worker task=${task.id} status=${result.status}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`worker task=${task.id} failed: ${message}`);
        }
      }
      return claimed.length;
    } finally {
      this.running = false;
    }
  }
}
