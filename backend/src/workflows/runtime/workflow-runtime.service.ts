import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowRegistryService } from '../registry/workflow-registry.service';
import { WorkflowVariablesService } from '../variables/workflow-variables.service';
import { WorkflowNodesService } from '../nodes/workflow-nodes.service';
import {
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
  WorkflowRunView,
} from '../types/workflow.types';

type Control = {
  paused: boolean;
  cancelled: boolean;
  resumeWaiters: Array<() => void>;
};

/**
 * Workflow Runtime：同步 / 异步 / 队列 / 暂停 / 恢复 / 取消 / 超时 / 重试。
 * 能力调用仅经 Agent Center / Tool Manager / MCP Gateway。
 */
@Injectable()
export class WorkflowRuntimeService {
  private readonly logger = new Logger(WorkflowRuntimeService.name);
  private readonly controls = new Map<number, Control>();
  private readonly queue: number[] = [];
  private draining = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: WorkflowRegistryService,
    private readonly variables: WorkflowVariablesService,
    private readonly nodes: WorkflowNodesService,
  ) {}

  private toRunView(row: {
    id: number;
    userId: number;
    status: string;
    mode: string;
    trigger: string;
    input: unknown;
    output: unknown;
    variables: unknown;
    error: string | null;
    latencyMs: number;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdAt: Date;
    workflow: { code: string; name: string };
    nodeRuns?: Array<{
      id: number;
      nodeId: string;
      nodeType: string;
      status: string;
      input: unknown;
      output: unknown;
      error: string | null;
      latencyMs: number;
      attempt: number;
      startedAt: Date | null;
      finishedAt: Date | null;
    }>;
  }): WorkflowRunView {
    return {
      id: row.id,
      workflowCode: row.workflow.code,
      workflowName: row.workflow.name,
      userId: row.userId,
      status: row.status,
      mode: row.mode,
      trigger: row.trigger,
      input: row.input,
      output: row.output,
      variables: row.variables,
      error: row.error,
      latencyMs: row.latencyMs,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      createdAt: row.createdAt,
      nodeRuns: row.nodeRuns?.map((n) => ({
        id: n.id,
        nodeId: n.nodeId,
        nodeType: n.nodeType,
        status: n.status,
        input: n.input,
        output: n.output,
        error: n.error,
        latencyMs: n.latencyMs,
        attempt: n.attempt,
        startedAt: n.startedAt,
        finishedAt: n.finishedAt,
      })),
    };
  }

  async getRun(id: number): Promise<WorkflowRunView> {
    const row = await this.prisma.workflowRun.findUnique({
      where: { id },
      include: {
        workflow: { select: { code: true, name: true } },
        nodeRuns: { orderBy: { id: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException(`run not found: ${id}`);
    return this.toRunView(row);
  }

  async execute(input: {
    code?: string;
    workflowId?: number;
    userId: number;
    roleCode: string;
    inputPayload?: Record<string, unknown>;
    mode?: 'sync' | 'async' | 'queue';
    trigger?: string;
  }): Promise<WorkflowRunView> {
    const wf = input.workflowId
      ? await this.registry.getRawById(input.workflowId)
      : await this.registry.getRawByCode(input.code ?? '');
    if (!wf.enabled || wf.status === 'disabled') {
      throw new BadRequestException('workflow disabled');
    }
    if (!this.registry.canAccess(wf, input.roleCode)) {
      throw new BadRequestException(`role ${input.roleCode} cannot execute workflow`);
    }

    const mode = input.mode ?? 'sync';
    const defaults =
      wf.variables && typeof wf.variables === 'object' && !Array.isArray(wf.variables)
        ? ((wf.variables as { defaults?: Record<string, unknown> }).defaults ?? {})
        : {};

    const run = await this.prisma.workflowRun.create({
      data: {
        workflowId: wf.id,
        userId: input.userId,
        status: mode === 'sync' ? 'running' : mode === 'queue' ? 'queued' : 'pending',
        mode,
        trigger: input.trigger ?? 'manual',
        input: (input.inputPayload ?? {}) as Prisma.InputJsonValue,
        variables: { defaults } as Prisma.InputJsonValue,
        startedAt: mode === 'sync' ? new Date() : null,
      },
      include: { workflow: { select: { code: true, name: true } } },
    });

    await this.registry.audit({
      workflowId: wf.id,
      runId: run.id,
      userId: input.userId,
      action: 'execute',
      detail: `mode=${mode}; trigger=${input.trigger ?? 'manual'}`,
    });

    if (mode === 'sync') {
      return this.runGraph(run.id, input.userId, input.roleCode);
    }

    if (mode === 'async') {
      setImmediate(() => {
        void this.runGraph(run.id, input.userId, input.roleCode).catch((err) => {
          this.logger.error(`async run ${run.id} failed: ${err instanceof Error ? err.message : err}`);
        });
      });
      return this.getRun(run.id);
    }

    // queue
    this.queue.push(run.id);
    void this.drainQueue(input.userId, input.roleCode);
    return this.getRun(run.id);
  }

  private async drainQueue(userId: number, roleCode: string) {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length) {
        const runId = this.queue.shift()!;
        try {
          await this.runGraph(runId, userId, roleCode);
        } catch (err) {
          this.logger.error(`queue run ${runId}: ${err instanceof Error ? err.message : err}`);
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private control(runId: number): Control {
    let c = this.controls.get(runId);
    if (!c) {
      c = { paused: false, cancelled: false, resumeWaiters: [] };
      this.controls.set(runId, c);
    }
    return c;
  }

  async pause(runId: number, userId: number) {
    const run = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException('run not found');
    if (run.status !== 'running') throw new BadRequestException('run is not running');
    this.control(runId).paused = true;
    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: { status: 'paused' },
    });
    await this.registry.audit({
      workflowId: run.workflowId,
      runId,
      userId,
      action: 'pause',
    });
    return this.getRun(runId);
  }

  async resume(runId: number, userId: number) {
    const run = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException('run not found');
    const c = this.control(runId);
    c.paused = false;
    const waiters = c.resumeWaiters.splice(0);
    waiters.forEach((w) => w());
    if (run.status === 'paused' || run.status === 'waiting_approval') {
      await this.prisma.workflowRun.update({
        where: { id: runId },
        data: { status: 'running' },
      });
    }
    await this.registry.audit({
      workflowId: run.workflowId,
      runId,
      userId,
      action: 'resume',
    });
    return this.getRun(runId);
  }

  async cancel(runId: number, userId: number) {
    const run = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException('run not found');
    this.control(runId).cancelled = true;
    this.control(runId).paused = false;
    this.control(runId).resumeWaiters.splice(0).forEach((w) => w());
    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: 'cancelled',
        finishedAt: new Date(),
        error: 'cancelled by user',
      },
    });
    await this.registry.audit({
      workflowId: run.workflowId,
      runId,
      userId,
      action: 'cancel',
    });
    return this.getRun(runId);
  }

  async approve(runId: number, userId: number, approved: boolean, comment?: string) {
    const run = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException('run not found');
    if (run.status !== 'waiting_approval') {
      throw new BadRequestException('run is not waiting for approval');
    }
    const vars = (run.variables as Record<string, unknown>) ?? {};
    vars.approval = { approved, comment, at: new Date().toISOString() };
    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: {
        variables: vars as Prisma.InputJsonValue,
        status: approved ? 'running' : 'cancelled',
        ...(approved
          ? {}
          : { finishedAt: new Date(), error: comment ?? 'approval rejected' }),
      },
    });
    await this.registry.audit({
      workflowId: run.workflowId,
      runId,
      userId,
      action: approved ? 'approve' : 'reject',
      detail: comment,
    });
    if (approved) {
      const c = this.control(runId);
      c.paused = false;
      c.resumeWaiters.splice(0).forEach((w) => w());
    }
    return this.getRun(runId);
  }

  private async waitIfNeeded(runId: number) {
    const c = this.control(runId);
    if (c.cancelled) throw new BadRequestException('cancelled');
    while (c.paused) {
      await new Promise<void>((resolve) => c.resumeWaiters.push(resolve));
      if (c.cancelled) throw new BadRequestException('cancelled');
    }
  }

  private pickNext(
    graph: WorkflowGraph,
    fromId: string,
    hint?: string,
    when?: string,
  ): WorkflowNode | null {
    if (hint) {
      const n = graph.nodes.find((x) => x.id === hint);
      if (n) return n;
    }
    const outs = graph.edges.filter((e) => e.from === fromId);
    let edge: WorkflowEdge | undefined;
    if (when) edge = outs.find((e) => e.when === when) ?? outs.find((e) => !e.when);
    else edge = outs.find((e) => !e.when) ?? outs[0];
    if (!edge) return null;
    return graph.nodes.find((n) => n.id === edge!.to) ?? null;
  }

  private async runGraph(runId: number, userId: number, roleCode: string): Promise<WorkflowRunView> {
    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: { workflow: true },
    });
    if (!run) throw new NotFoundException('run not found');

    const started = Date.now();
    const graph = run.workflow.graph as WorkflowGraph;
    const defaults =
      run.workflow.variables && typeof run.workflow.variables === 'object'
        ? ((run.workflow.variables as { defaults?: Record<string, unknown> }).defaults ?? {})
        : {};
    const ctx = this.variables.createContext({
      input: (run.input as Record<string, unknown>) ?? {},
      defaults,
    });

    this.control(runId);
    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: { status: 'running', startedAt: run.startedAt ?? new Date() },
    });

    let current: WorkflowNode | null = graph.nodes.find((n) => n.type === 'start') ?? null;
    const outputs: Record<string, unknown> = {};
    let finalStatus = 'success';
    let finalError: string | undefined;

    const timeoutMs = run.workflow.timeoutMs;
    const deadline = Date.now() + timeoutMs;

    try {
      while (current) {
        if (Date.now() > deadline) {
          finalStatus = 'timeout';
          finalError = `workflow timeout after ${timeoutMs}ms`;
          break;
        }
        await this.waitIfNeeded(runId);

        const nodeStarted = Date.now();
        const nodeRun = await this.prisma.workflowNodeRun.create({
          data: {
            runId,
            nodeId: current.id,
            nodeType: current.type,
            status: 'running',
            input: (current.config ?? {}) as Prisma.InputJsonValue,
            startedAt: new Date(),
            attempt: 1,
          },
        });

        let nodeOutput: unknown = null;
        let nextHint: string | undefined;
        let waitApproval = false;
        let nodeError: string | undefined;
        let nodeStatus = 'success';

        const maxAttempts = Math.max(1, run.workflow.maxRetries + 1);
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            await this.prisma.workflowNodeRun.update({
              where: { id: nodeRun.id },
              data: { attempt },
            });
            const result = await this.nodes.executeNode({
              node: current,
              userId,
              roleCode,
              ctx,
            });
            nodeOutput = result.output;
            nextHint = result.nextHint;
            waitApproval = Boolean(result.waitApproval);
            nodeStatus = 'success';
            nodeError = undefined;
            break;
          } catch (err) {
            nodeError = err instanceof Error ? err.message : String(err);
            nodeStatus = 'error';
            if (attempt >= maxAttempts) break;
          }
        }

        await this.prisma.workflowNodeRun.update({
          where: { id: nodeRun.id },
          data: {
            status: waitApproval ? 'waiting' : nodeStatus,
            output: nodeOutput === null ? undefined : (nodeOutput as Prisma.InputJsonValue),
            error: nodeError?.slice(0, 2000),
            latencyMs: Date.now() - nodeStarted,
            finishedAt: waitApproval ? null : new Date(),
          },
        });

        outputs[current.id] = nodeOutput;
        this.variables.setVar(ctx, 'lastNodeId', current.id);
        this.variables.setVar(ctx, 'lastNodeType', current.type);

        if (nodeStatus === 'error') {
          finalStatus = 'error';
          finalError = nodeError;
          break;
        }

        if (waitApproval) {
          await this.prisma.workflowRun.update({
            where: { id: runId },
            data: {
              status: 'waiting_approval',
              variables: ctx as unknown as Prisma.InputJsonValue,
            },
          });
          this.control(runId).paused = true;
          await this.waitIfNeeded(runId);
          const refreshed = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
          if (!refreshed || refreshed.status === 'cancelled') {
            finalStatus = 'cancelled';
            finalError = refreshed?.error ?? 'cancelled';
            break;
          }
          const approval = (refreshed.variables as { approval?: { approved?: boolean } })?.approval;
          if (approval && approval.approved === false) {
            finalStatus = 'cancelled';
            finalError = 'approval rejected';
            break;
          }
        }

        if (current.type === 'end') break;

        const when =
          current.type === 'condition' && nodeOutput && typeof nodeOutput === 'object'
            ? (nodeOutput as { result?: boolean }).result
              ? 'true'
              : 'false'
            : undefined;
        current = this.pickNext(graph, current.id, nextHint, when);
      }
    } catch (err) {
      finalStatus = 'error';
      finalError = err instanceof Error ? err.message : String(err);
    }

    const latencyMs = Date.now() - started;
    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: finalStatus,
        output: outputs as Prisma.InputJsonValue,
        variables: ctx as unknown as Prisma.InputJsonValue,
        error: finalError?.slice(0, 2000),
        latencyMs,
        finishedAt: new Date(),
      },
    });
    this.controls.delete(runId);
    return this.getRun(runId);
  }
}
