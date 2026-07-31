import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAgentDto, UpdateAgentDto } from '../dto/agent.dto';
import { AgentProfileView } from '../types/agent.types';

@Injectable()
export class AgentRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  private toView(agent: {
    id: number;
    code: string;
    name: string;
    description: string | null;
    avatar: string | null;
    systemPrompt: string;
    status: string;
    enabled: boolean;
    version: string;
    defaultModel: string | null;
    defaultKnowledgeScope: string | null;
    roleAccess: string | null;
    sortOrder: number;
    builtin: boolean;
    createdAt: Date;
    updatedAt: Date;
    skills: Array<{ skill: { code: string; name: string; reserved: boolean; enabled: boolean } }>;
  }): AgentProfileView {
    return {
      id: agent.id,
      code: agent.code,
      name: agent.name,
      description: agent.description,
      avatar: agent.avatar,
      systemPrompt: agent.systemPrompt,
      status: agent.status,
      enabled: agent.enabled,
      version: agent.version,
      defaultModel: agent.defaultModel,
      defaultKnowledgeScope: agent.defaultKnowledgeScope,
      roleAccess: agent.roleAccess,
      sortOrder: agent.sortOrder,
      builtin: agent.builtin,
      skills: agent.skills.map((s) => s.skill),
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };
  }

  private includeSkills() {
    return { skills: { include: { skill: true } } } as const;
  }

  async list(opts: { enabled?: boolean; status?: string } = {}): Promise<AgentProfileView[]> {
    const rows = await this.prisma.agent.findMany({
      where: {
        ...(opts.enabled !== undefined ? { enabled: opts.enabled } : {}),
        ...(opts.status ? { status: opts.status } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: this.includeSkills(),
    });
    return rows.map((r) => this.toView(r));
  }

  async getByCode(code: string): Promise<AgentProfileView> {
    const row = await this.prisma.agent.findUnique({
      where: { code },
      include: this.includeSkills(),
    });
    if (!row) throw new NotFoundException(`agent not found: ${code}`);
    return this.toView(row);
  }

  async getById(id: number): Promise<AgentProfileView> {
    const row = await this.prisma.agent.findUnique({
      where: { id },
      include: this.includeSkills(),
    });
    if (!row) throw new NotFoundException('agent not found');
    return this.toView(row);
  }

  private async bindSkills(agentId: number, skillCodes?: string[]) {
    if (!skillCodes) return;
    const skills = await this.prisma.agentSkill.findMany({
      where: { code: { in: skillCodes } },
    });
    if (skills.length !== skillCodes.length) {
      throw new BadRequestException('one or more skillCodes are invalid');
    }
    await this.prisma.agentSkillBinding.deleteMany({ where: { agentId } });
    if (skills.length) {
      await this.prisma.agentSkillBinding.createMany({
        data: skills.map((s) => ({ agentId, skillId: s.id })),
      });
    }
  }

  async create(dto: CreateAgentDto): Promise<AgentProfileView> {
    const code = dto.code.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]{1,58}$/.test(code)) {
      throw new BadRequestException('invalid agent code');
    }
    const created = await this.prisma.agent.create({
      data: {
        code,
        name: dto.name.trim(),
        description: dto.description,
        avatar: dto.avatar,
        systemPrompt: dto.systemPrompt,
        status: dto.status ?? 'active',
        enabled: dto.enabled ?? true,
        version: dto.version ?? '1.0.0',
        defaultModel: dto.defaultModel,
        defaultKnowledgeScope: dto.defaultKnowledgeScope,
        roleAccess: dto.roleAccess,
        sortOrder: dto.sortOrder ?? 100,
        builtin: false,
      },
    });
    await this.bindSkills(created.id, dto.skillCodes ?? ['chat']);
    return this.getById(created.id);
  }

  async update(code: string, dto: UpdateAgentDto): Promise<AgentProfileView> {
    const existing = await this.prisma.agent.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException(`agent not found: ${code}`);
    await this.prisma.agent.update({
      where: { code },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.avatar !== undefined ? { avatar: dto.avatar } : {}),
        ...(dto.systemPrompt !== undefined ? { systemPrompt: dto.systemPrompt } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.version !== undefined ? { version: dto.version } : {}),
        ...(dto.defaultModel !== undefined ? { defaultModel: dto.defaultModel } : {}),
        ...(dto.defaultKnowledgeScope !== undefined
          ? { defaultKnowledgeScope: dto.defaultKnowledgeScope }
          : {}),
        ...(dto.roleAccess !== undefined ? { roleAccess: dto.roleAccess } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    if (dto.skillCodes) await this.bindSkills(existing.id, dto.skillCodes);
    return this.getByCode(code);
  }

  async setEnabled(code: string, enabled: boolean): Promise<AgentProfileView> {
    return this.update(code, {
      enabled,
      status: enabled ? 'active' : 'disabled',
    });
  }

  async remove(code: string): Promise<{ deleted: boolean }> {
    const existing = await this.prisma.agent.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException(`agent not found: ${code}`);
    if (existing.builtin) throw new BadRequestException('builtin agents cannot be deleted');
    await this.prisma.agent.delete({ where: { code } });
    return { deleted: true };
  }
}
