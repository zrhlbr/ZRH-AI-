import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AgentLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: { page?: number; pageSize?: number; agentCode?: string; userId?: number }) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const agent = opts.agentCode
      ? await this.prisma.agent.findUnique({ where: { code: opts.agentCode } })
      : null;
    const where = {
      ...(agent ? { agentId: agent.id } : {}),
      ...(opts.userId ? { userId: opts.userId } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.agentRunLog.count({ where }),
      this.prisma.agentRunLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { agent: { select: { code: true, name: true } } },
      }),
    ]);
    return { page, pageSize, total, items };
  }
}
