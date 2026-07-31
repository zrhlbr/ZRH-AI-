import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ToolLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: { page?: number; pageSize?: number; toolCode?: string } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const where = opts.toolCode
      ? { tool: { code: opts.toolCode } }
      : {};
    const [total, items] = await Promise.all([
      this.prisma.toolRunLog.count({ where }),
      this.prisma.toolRunLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { tool: { select: { code: true, name: true } } },
      }),
    ]);
    return { page, pageSize, total, items };
  }
}
