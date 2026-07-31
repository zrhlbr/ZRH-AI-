import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentRegistryService } from '../registry/agent-registry.service';
import { AgentSkillsService } from '../skills/agent-skills.service';

@Injectable()
export class AgentHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AgentRegistryService,
    private readonly skills: AgentSkillsService,
  ) {}

  async status() {
    const [agents, skills, recentErrors, totalLogs] = await Promise.all([
      this.registry.list(),
      this.skills.list(),
      this.prisma.agentRunLog.count({
        where: {
          status: 'error',
          createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
        },
      }),
      this.prisma.agentRunLog.count(),
    ]);
    const active = agents.filter((a) => a.enabled && a.status === 'active');
    return {
      agents: {
        total: agents.length,
        active: active.length,
        disabled: agents.length - active.length,
      },
      skills: {
        total: skills.length,
        enabled: skills.filter((s) => s.enabled).length,
        reserved: skills.filter((s) => s.reserved).length,
      },
      logs: {
        total: totalLogs,
        errors24h: recentErrors,
      },
      ok: active.length > 0,
    };
  }
}
