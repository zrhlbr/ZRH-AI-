import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowRegistryService } from '../registry/workflow-registry.service';
import { WorkflowRuntimeService } from '../runtime/workflow-runtime.service';
import { CreateScheduleDto } from '../dto/workflow.dto';

/**
 * Workflow Scheduler：立即 / 定时 / Cron / 周期 / 手动；事件触发预留。
 */
@Injectable()
export class WorkflowSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowSchedulerService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: WorkflowRegistryService,
    private readonly runtime: WorkflowRuntimeService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick().catch((err) => {
        this.logger.warn(`scheduler tick: ${err instanceof Error ? err.message : err}`);
      });
    }, 15000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private nextFromCron(cronExpr: string, from = new Date()): Date {
    // 支持：*/N * * * * （每 N 分钟）或 0 * * * *（每小时）
    const everyMin = cronExpr.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
    if (everyMin) {
      const n = Math.max(1, Number(everyMin[1]));
      return new Date(from.getTime() + n * 60 * 1000);
    }
    if (cronExpr.trim() === '0 * * * *') {
      const d = new Date(from);
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() + 1);
      return d;
    }
    // 默认 1 小时
    return new Date(from.getTime() + 3600 * 1000);
  }

  async list() {
    return this.prisma.workflowSchedule.findMany({
      orderBy: { id: 'desc' },
      include: { workflow: { select: { code: true, name: true } } },
      take: 100,
    });
  }

  async create(dto: CreateScheduleDto, userId: number) {
    if (dto.kind === 'event_reserved') {
      throw new BadRequestException('event trigger is reserved in Stage 9');
    }
    const wf = await this.registry.getRawByCode(dto.workflowCode);
    let nextRunAt: Date | null = new Date();
    if (dto.kind === 'cron') {
      if (!dto.cronExpr) throw new BadRequestException('cronExpr required');
      nextRunAt = this.nextFromCron(dto.cronExpr);
    } else if (dto.kind === 'interval') {
      const sec = dto.intervalSec ?? 300;
      nextRunAt = new Date(Date.now() + sec * 1000);
    } else if (dto.kind === 'once') {
      nextRunAt = new Date(Date.now() + 5000);
    }

    const created = await this.prisma.workflowSchedule.create({
      data: {
        workflowId: wf.id,
        name: dto.name.trim(),
        enabled: dto.enabled ?? true,
        kind: dto.kind,
        cronExpr: dto.cronExpr,
        intervalSec: dto.intervalSec,
        nextRunAt,
      },
      include: { workflow: { select: { code: true, name: true } } },
    });
    await this.registry.audit({
      workflowId: wf.id,
      userId,
      action: 'schedule_create',
      detail: `schedule=${created.id}; kind=${dto.kind}`,
    });
    return created;
  }

  async setEnabled(id: number, enabled: boolean) {
    const row = await this.prisma.workflowSchedule.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('schedule not found');
    return this.prisma.workflowSchedule.update({
      where: { id },
      data: { enabled },
      include: { workflow: { select: { code: true, name: true } } },
    });
  }

  async remove(id: number) {
    await this.prisma.workflowSchedule.delete({ where: { id } });
    return { deleted: true, id };
  }

  /** 立即触发一次（手动） */
  async triggerNow(workflowCode: string, userId: number, roleCode: string) {
    return this.runtime.execute({
      code: workflowCode,
      userId,
      roleCode,
      mode: 'async',
      trigger: 'manual',
      inputPayload: {},
    });
  }

  private async tick() {
    const due = await this.prisma.workflowSchedule.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: new Date() },
        kind: { not: 'event_reserved' },
      },
      include: { workflow: true },
      take: 10,
    });
    for (const s of due) {
      if (!s.workflow.enabled) continue;
      try {
        // 调度执行使用系统用户 id=1（超管）；生产可改为 service account
        await this.runtime.execute({
          workflowId: s.workflowId,
          userId: 1,
          roleCode: 'SUPER_ADMIN',
          mode: 'async',
          trigger: s.kind === 'cron' ? 'cron' : 'schedule',
          inputPayload: {},
        });
        let next: Date | null = null;
        if (s.kind === 'once') {
          await this.prisma.workflowSchedule.update({
            where: { id: s.id },
            data: { enabled: false, lastRunAt: new Date(), nextRunAt: null },
          });
          continue;
        }
        if (s.kind === 'interval') {
          next = new Date(Date.now() + (s.intervalSec ?? 300) * 1000);
        } else if (s.kind === 'cron' && s.cronExpr) {
          next = this.nextFromCron(s.cronExpr);
        }
        await this.prisma.workflowSchedule.update({
          where: { id: s.id },
          data: { lastRunAt: new Date(), nextRunAt: next },
        });
      } catch (err) {
        this.logger.warn(
          `schedule ${s.id} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        await this.prisma.workflowSchedule.update({
          where: { id: s.id },
          data: {
            lastRunAt: new Date(),
            nextRunAt: new Date(Date.now() + 60000),
          },
        });
      }
    }
  }
}
