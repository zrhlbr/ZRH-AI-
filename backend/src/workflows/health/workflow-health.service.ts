import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowRegistryService } from '../registry/workflow-registry.service';

@Injectable()
export class WorkflowHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: WorkflowRegistryService,
  ) {}

  async status() {
    const [workflows, templates, schedules, errors24h, totalRuns, successRuns] =
      await Promise.all([
        this.registry.list(),
        this.registry.listTemplates(),
        this.prisma.workflowSchedule.count({ where: { enabled: true } }),
        this.prisma.workflowRun.count({
          where: {
            status: { in: ['error', 'timeout', 'cancelled'] },
            createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
          },
        }),
        this.prisma.workflowRun.count(),
        this.prisma.workflowRun.count({ where: { status: 'success' } }),
      ]);
    const enabled = workflows.filter((w) => w.enabled);
    return {
      workflows: {
        total: workflows.length,
        enabled: enabled.length,
        templates: templates.length,
      },
      schedules: { enabled: schedules },
      runs: {
        total: totalRuns,
        success: successRuns,
        errors24h,
      },
      architecture: 'Workflow → Agent Center → Tool Manager → MCP Gateway → External',
      ok: templates.length >= 10 && enabled.length >= 10,
    };
  }
}
