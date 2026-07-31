import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ToolRegistryService } from '../registry/tool-registry.service';
import { BuiltinExecutorsService } from './builtin-executors.service';
import { ToolExecuteResult, ToolRunMode } from '../types/tool.types';

@Injectable()
export class ToolRuntimeService {
  private readonly logger = new Logger(ToolRuntimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ToolRegistryService,
    private readonly executors: BuiltinExecutorsService,
  ) {}

  private validateArgs(schema: unknown, args: Record<string, unknown>) {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return;
    const s = schema as Record<string, string>;
    for (const [key, ruleRaw] of Object.entries(s)) {
      const rule = String(ruleRaw);
      const optional = rule.endsWith('?') || rule.includes('|');
      const base = rule.replace(/\?$/, '').split('|')[0];
      const val = args[key];
      const missing = val === undefined || val === null || val === '';
      if (missing) {
        if (!optional && (base === 'string' || base === 'number')) {
          throw new BadRequestException(`missing required arg: ${key}`);
        }
        continue;
      }
      if (base === 'string' && typeof val !== 'string') {
        throw new BadRequestException(`arg ${key} must be string`);
      }
      if (base === 'number' && typeof val !== 'number' && Number.isNaN(Number(val))) {
        throw new BadRequestException(`arg ${key} must be number`);
      }
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`tool timeout after ${ms}ms`)), ms);
      promise
        .then((v) => {
          clearTimeout(timer);
          resolve(v);
        })
        .catch((e) => {
          clearTimeout(timer);
          reject(e);
        });
    });
  }

  async execute(input: {
    toolCode: string;
    userId: number;
    roleCode: string;
    args?: Record<string, unknown>;
    mode?: ToolRunMode;
    agentCode?: string;
  }): Promise<ToolExecuteResult> {
    const mode: ToolRunMode = input.mode ?? 'sync';
    const tool = await this.registry.getRawByCode(input.toolCode);
    if (!tool.enabled) throw new BadRequestException(`tool disabled: ${tool.code}`);
    if (!this.registry.canAccess(tool, input.roleCode)) {
      throw new BadRequestException(`role ${input.roleCode} cannot access tool ${tool.code}`);
    }

    const args = input.args ?? {};
    this.validateArgs(tool.inputSchema, args);

    if (mode === 'async') {
      // 框架：异步排队语义 —— 当前同步执行并标记 mode=async（后续可接队列）
      this.logger.log(`async mode accepted for ${tool.code} (inline execute)`);
    }
    if (mode === 'streaming') {
      this.logger.log(`streaming mode accepted for ${tool.code} (single-chunk result)`);
    }

    const started = Date.now();
    let attempt = 0;
    let lastError: string | undefined;
    const maxAttempts = Math.max(1, tool.maxRetries + 1);

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const output = await this.withTimeout(
          this.executors.execute(tool.executorCode, { userId: input.userId, args }),
          tool.timeoutMs,
        );
        const latencyMs = Date.now() - started;
        const log = await this.prisma.toolRunLog.create({
          data: {
            toolId: tool.id,
            userId: input.userId,
            agentCode: input.agentCode,
            status: 'success',
            input: args as Prisma.InputJsonValue,
            output: output as Prisma.InputJsonValue,
            latencyMs,
          },
        });
        return {
          toolCode: tool.code,
          status: 'success',
          mode,
          output,
          latencyMs,
          logId: log.id,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        const isTimeout = lastError.includes('timeout');
        if (attempt >= maxAttempts) {
          const latencyMs = Date.now() - started;
          const log = await this.prisma.toolRunLog.create({
            data: {
              toolId: tool.id,
              userId: input.userId,
              agentCode: input.agentCode,
              status: isTimeout ? 'timeout' : 'error',
              input: args as Prisma.InputJsonValue,
              error: lastError.slice(0, 2000),
              latencyMs,
            },
          });
          return {
            toolCode: tool.code,
            status: isTimeout ? 'timeout' : 'error',
            mode,
            output: null,
            error: lastError,
            latencyMs,
            logId: log.id,
          };
        }
      }
    }

    return {
      toolCode: tool.code,
      status: 'error',
      mode,
      output: null,
      error: lastError ?? 'unknown error',
      latencyMs: Date.now() - started,
    };
  }
}
