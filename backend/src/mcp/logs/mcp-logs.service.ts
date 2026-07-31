import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class McpLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: { page?: number; pageSize?: number; serverCode?: string } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const where = opts.serverCode ? { server: { code: opts.serverCode } } : {};
    const [total, items] = await Promise.all([
      this.prisma.mcpRunLog.count({ where }),
      this.prisma.mcpRunLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { server: { select: { code: true, name: true } } },
      }),
    ]);
    return { page, pageSize, total, items };
  }
}
