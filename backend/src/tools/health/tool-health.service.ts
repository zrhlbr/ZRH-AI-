import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ToolRegistryService } from '../registry/tool-registry.service';

@Injectable()
export class ToolHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ToolRegistryService,
  ) {}

  async status() {
    const [tools, categories, recentErrors, totalLogs, successLogs] = await Promise.all([
      this.registry.list(),
      this.registry.listCategories(),
      this.prisma.toolRunLog.count({
        where: {
          status: { in: ['error', 'timeout'] },
          createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
        },
      }),
      this.prisma.toolRunLog.count(),
      this.prisma.toolRunLog.count({ where: { status: 'success' } }),
    ]);
    const enabled = tools.filter((t) => t.enabled);
    return {
      tools: {
        total: tools.length,
        enabled: enabled.length,
        disabled: tools.length - enabled.length,
        builtin: tools.filter((t) => t.builtin).length,
      },
      categories: {
        total: categories.length,
      },
      logs: {
        total: totalLogs,
        success: successLogs,
        errors24h: recentErrors,
      },
      ok: enabled.length >= 10,
    };
  }
}
