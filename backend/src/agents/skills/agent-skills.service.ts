import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AgentSkillsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.agentSkill.findMany({
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
  }

  async getEnabledCodes(agentId: number): Promise<string[]> {
    const bindings = await this.prisma.agentSkillBinding.findMany({
      where: { agentId, skill: { enabled: true } },
      include: { skill: true },
    });
    return bindings.map((b) => b.skill.code);
  }
}
