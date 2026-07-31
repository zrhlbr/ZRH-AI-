import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BusinessAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    systemId: number;
    userId: number;
    action: string;
    workflowCode?: string;
    workflowRunId?: number;
    status: string;
    detail?: string;
    departmentId?: number;
    companyCode?: string;
  }) {
    return this.prisma.businessAuditLog.create({
      data: {
        systemId: input.systemId,
        userId: input.userId,
        action: input.action,
        workflowCode: input.workflowCode,
        workflowRunId: input.workflowRunId,
        status: input.status,
        detail: input.detail?.slice(0, 2000),
        departmentId: input.departmentId,
        companyCode: input.companyCode,
      },
    });
  }

  async list(opts: { page?: number; pageSize?: number; systemCode?: string } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const where = opts.systemCode ? { system: { code: opts.systemCode } } : {};
    const [total, items] = await Promise.all([
      this.prisma.businessAuditLog.count({ where }),
      this.prisma.businessAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { system: { select: { code: true, name: true } } },
      }),
    ]);
    return { page, pageSize, total, items };
  }
}
