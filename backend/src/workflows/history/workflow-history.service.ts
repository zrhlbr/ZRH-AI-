import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WorkflowHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: {
    page?: number;
    pageSize?: number;
    workflowCode?: string;
    status?: string;
  } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const where = {
      ...(opts.workflowCode ? { workflow: { code: opts.workflowCode } } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.workflowRun.count({ where }),
      this.prisma.workflowRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          workflow: { select: { code: true, name: true } },
          _count: { select: { nodeRuns: true } },
        },
      }),
    ]);
    return { page, pageSize, total, items };
  }

  async get(runId: number) {
    const row = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: { select: { code: true, name: true } },
        nodeRuns: { orderBy: { id: 'asc' } },
        audits: { orderBy: { createdAt: 'asc' }, take: 100 },
      },
    });
    if (!row) throw new NotFoundException('run not found');
    return row;
  }

  async listLogs(opts: { page?: number; pageSize?: number; workflowCode?: string } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const where = opts.workflowCode
      ? { workflow: { code: opts.workflowCode } }
      : {};
    const [total, items] = await Promise.all([
      this.prisma.workflowAuditLog.count({ where }),
      this.prisma.workflowAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { workflow: { select: { code: true, name: true } } },
      }),
    ]);
    return { page, pageSize, total, items };
  }
}
