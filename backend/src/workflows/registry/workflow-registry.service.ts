import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CopyWorkflowDto,
  CreateWorkflowDto,
  ImportWorkflowDto,
  UpdateWorkflowDto,
} from '../dto/workflow.dto';
import {
  WorkflowDefinitionView,
  WorkflowGraph,
} from '../types/workflow.types';

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class WorkflowRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  private parseGraph(raw: unknown): WorkflowGraph {
    const g = raw as WorkflowGraph;
    if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) {
      throw new BadRequestException('invalid workflow graph');
    }
    const types = new Set([
      'start',
      'end',
      'agent',
      'tool',
      'mcp',
      'condition',
      'loop',
      'delay',
      'switch',
      'merge',
      'approval',
      'webhook',
    ]);
    for (const n of g.nodes) {
      if (!n.id || !types.has(n.type)) {
        throw new BadRequestException(`invalid node: ${n?.id ?? '?'}`);
      }
    }
    if (!g.nodes.some((n) => n.type === 'start')) {
      throw new BadRequestException('graph must contain a start node');
    }
    if (!g.nodes.some((n) => n.type === 'end')) {
      throw new BadRequestException('graph must contain an end node');
    }
    return g;
  }

  private toView(row: {
    id: number;
    code: string;
    name: string;
    description: string | null;
    version: string;
    enabled: boolean;
    builtin: boolean;
    template: boolean;
    status: string;
    graph: unknown;
    variables: unknown;
    roleAccess: string | null;
    timeoutMs: number;
    maxRetries: number;
    createdAt: Date;
    updatedAt: Date;
    category: { code: string; name: string };
  }): WorkflowDefinitionView {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      categoryCode: row.category.code,
      categoryName: row.category.name,
      version: row.version,
      enabled: row.enabled,
      builtin: row.builtin,
      template: row.template,
      status: row.status,
      graph: row.graph as WorkflowGraph,
      variables: row.variables,
      roleAccess: row.roleAccess,
      timeoutMs: row.timeoutMs,
      maxRetries: row.maxRetries,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  canAccess(wf: { roleAccess: string | null }, roleCode: string): boolean {
    if (!wf.roleAccess) return true;
    if (roleCode === 'SUPER_ADMIN') return true;
    try {
      const roles = JSON.parse(wf.roleAccess) as string[];
      if (!Array.isArray(roles) || roles.length === 0) return true;
      return roles.includes(roleCode);
    } catch {
      return wf.roleAccess.split(',').map((s) => s.trim()).includes(roleCode);
    }
  }

  async listCategories() {
    const rows = await this.prisma.workflowCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { workflows: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      sortOrder: r.sortOrder,
      workflowCount: r._count.workflows,
    }));
  }

  async list(opts: {
    enabled?: boolean;
    template?: boolean;
    category?: string;
  } = {}): Promise<WorkflowDefinitionView[]> {
    const rows = await this.prisma.workflowDefinition.findMany({
      where: {
        ...(opts.enabled !== undefined ? { enabled: opts.enabled } : {}),
        ...(opts.template !== undefined ? { template: opts.template } : {}),
        ...(opts.category ? { category: { code: opts.category } } : {}),
      },
      orderBy: [{ name: 'asc' }],
      include: { category: true },
    });
    return rows.map((r) => this.toView(r));
  }

  async listTemplates(): Promise<WorkflowDefinitionView[]> {
    return this.list({ template: true });
  }

  async getByCode(code: string): Promise<WorkflowDefinitionView> {
    const row = await this.prisma.workflowDefinition.findUnique({
      where: { code },
      include: { category: true },
    });
    if (!row) throw new NotFoundException(`workflow not found: ${code}`);
    return this.toView(row);
  }

  async getRawByCode(code: string) {
    const row = await this.prisma.workflowDefinition.findUnique({
      where: { code },
      include: { category: true },
    });
    if (!row) throw new NotFoundException(`workflow not found: ${code}`);
    return row;
  }

  async getRawById(id: number) {
    const row = await this.prisma.workflowDefinition.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!row) throw new NotFoundException('workflow not found');
    return row;
  }

  private async resolveCategoryId(code: string): Promise<number> {
    const cat = await this.prisma.workflowCategory.findUnique({ where: { code } });
    if (!cat) throw new BadRequestException('invalid categoryCode');
    return cat.id;
  }

  async create(dto: CreateWorkflowDto): Promise<WorkflowDefinitionView> {
    const code = dto.code.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]{1,78}$/.test(code)) {
      throw new BadRequestException('invalid workflow code');
    }
    const graph = this.parseGraph(dto.graph);
    const categoryId = await this.resolveCategoryId(dto.categoryCode);
    const created = await this.prisma.workflowDefinition.create({
      data: {
        code,
        name: dto.name.trim(),
        description: dto.description,
        categoryId,
        graph: asJson(graph),
        variables: dto.variables === undefined ? undefined : asJson(dto.variables),
        version: dto.version ?? '1.0.0',
        enabled: dto.enabled ?? true,
        status: dto.status ?? 'active',
        roleAccess: dto.roleAccess,
        timeoutMs: dto.timeoutMs ?? 120000,
        maxRetries: dto.maxRetries ?? 0,
        builtin: false,
        template: false,
      },
      include: { category: true },
    });
    return this.toView(created);
  }

  async update(code: string, dto: UpdateWorkflowDto): Promise<WorkflowDefinitionView> {
    const existing = await this.getRawByCode(code);
    let categoryId = existing.categoryId;
    if (dto.categoryCode) categoryId = await this.resolveCategoryId(dto.categoryCode);
    const graph = dto.graph === undefined ? undefined : this.parseGraph(dto.graph);
    const updated = await this.prisma.workflowDefinition.update({
      where: { id: existing.id },
      data: {
        name: dto.name?.trim(),
        description: dto.description,
        categoryId,
        graph: graph === undefined ? undefined : asJson(graph),
        variables: dto.variables === undefined ? undefined : asJson(dto.variables),
        version: dto.version,
        enabled: dto.enabled,
        status: dto.status,
        roleAccess: dto.roleAccess,
        timeoutMs: dto.timeoutMs,
        maxRetries: dto.maxRetries,
      },
      include: { category: true },
    });
    return this.toView(updated);
  }

  async setEnabled(code: string, enabled: boolean): Promise<WorkflowDefinitionView> {
    await this.getRawByCode(code);
    const updated = await this.prisma.workflowDefinition.update({
      where: { code },
      data: { enabled, status: enabled ? 'active' : 'disabled' },
      include: { category: true },
    });
    return this.toView(updated);
  }

  async remove(code: string): Promise<{ deleted: true; code: string }> {
    const row = await this.getRawByCode(code);
    if (row.builtin) {
      throw new BadRequestException('builtin workflows cannot be deleted; disable instead');
    }
    await this.prisma.workflowDefinition.delete({ where: { id: row.id } });
    return { deleted: true, code };
  }

  async copy(code: string, dto: CopyWorkflowDto): Promise<WorkflowDefinitionView> {
    const src = await this.getRawByCode(code);
    return this.create({
      code: dto.newCode,
      name: dto.newName ?? `${src.name} (copy)`,
      description: src.description ?? undefined,
      categoryCode: src.category.code,
      graph: src.graph as Record<string, unknown>,
      variables: (src.variables as Record<string, unknown>) ?? undefined,
      version: '1.0.0',
      enabled: true,
      status: 'draft',
      roleAccess: src.roleAccess ?? undefined,
      timeoutMs: src.timeoutMs,
      maxRetries: src.maxRetries,
    });
  }

  async export(code: string) {
    const wf = await this.getByCode(code);
    return {
      format: 'zrh-workflow-v1',
      exportedAt: new Date().toISOString(),
      definition: wf,
    };
  }

  async import(dto: ImportWorkflowDto): Promise<WorkflowDefinitionView> {
    const def = dto.definition as Record<string, unknown>;
    const code = String(def.code ?? '').trim().toLowerCase();
    const name = String(def.name ?? code);
    const categoryCode = String(def.categoryCode ?? 'ops');
    const graph = def.graph as Record<string, unknown>;
    if (!code || !graph) throw new BadRequestException('import requires code and graph');
    const exists = await this.prisma.workflowDefinition.findUnique({ where: { code } });
    if (exists) {
      return this.update(code, {
        name,
        description: def.description ? String(def.description) : undefined,
        categoryCode,
        graph,
        variables: (def.variables as Record<string, unknown>) ?? undefined,
        version: def.version ? String(def.version) : undefined,
      });
    }
    return this.create({
      code,
      name,
      description: def.description ? String(def.description) : undefined,
      categoryCode,
      graph,
      variables: (def.variables as Record<string, unknown>) ?? undefined,
      version: def.version ? String(def.version) : '1.0.0',
    });
  }

  async audit(input: {
    workflowId: number;
    runId?: number;
    userId: number;
    action: string;
    detail?: string;
  }) {
    await this.prisma.workflowAuditLog.create({
      data: {
        workflowId: input.workflowId,
        runId: input.runId,
        userId: input.userId,
        action: input.action,
        detail: input.detail?.slice(0, 2000),
      },
    });
  }
}
