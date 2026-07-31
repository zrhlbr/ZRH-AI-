import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateToolDto, UpdateToolDto } from '../dto/tool.dto';
import { ToolCategoryView, ToolDefinitionView } from '../types/tool.types';

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class ToolRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  private toView(row: {
    id: number;
    code: string;
    name: string;
    description: string | null;
    version: string;
    enabled: boolean;
    builtin: boolean;
    inputSchema: unknown;
    outputSchema: unknown;
    timeoutMs: number;
    maxRetries: number;
    roleAccess: string | null;
    executorCode: string;
    config: unknown;
    createdAt: Date;
    updatedAt: Date;
    category: { code: string; name: string };
  }): ToolDefinitionView {
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
      inputSchema: row.inputSchema,
      outputSchema: row.outputSchema,
      timeoutMs: row.timeoutMs,
      maxRetries: row.maxRetries,
      roleAccess: row.roleAccess,
      executorCode: row.executorCode,
      config: row.config,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /** RBAC：roleAccess 为空则任意持有 api:tools:execute 的角色可用 */
  canAccess(tool: { roleAccess: string | null }, roleCode: string): boolean {
    if (!tool.roleAccess) return true;
    try {
      const roles = JSON.parse(tool.roleAccess) as string[];
      if (!Array.isArray(roles) || roles.length === 0) return true;
      return roles.includes(roleCode);
    } catch {
      return tool.roleAccess.split(',').map((s) => s.trim()).includes(roleCode);
    }
  }

  async listCategories(): Promise<ToolCategoryView[]> {
    const rows = await this.prisma.toolCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { tools: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      sortOrder: r.sortOrder,
      toolCount: r._count.tools,
    }));
  }

  async list(opts: { enabled?: boolean; category?: string } = {}): Promise<ToolDefinitionView[]> {
    const rows = await this.prisma.toolDefinition.findMany({
      where: {
        ...(opts.enabled !== undefined ? { enabled: opts.enabled } : {}),
        ...(opts.category ? { category: { code: opts.category } } : {}),
      },
      orderBy: [{ name: 'asc' }],
      include: { category: true },
    });
    return rows.map((r) => this.toView(r));
  }

  async getByCode(code: string): Promise<ToolDefinitionView> {
    const row = await this.prisma.toolDefinition.findUnique({
      where: { code },
      include: { category: true },
    });
    if (!row) throw new NotFoundException(`tool not found: ${code}`);
    return this.toView(row);
  }

  async getRawByCode(code: string) {
    const row = await this.prisma.toolDefinition.findUnique({
      where: { code },
      include: { category: true },
    });
    if (!row) throw new NotFoundException(`tool not found: ${code}`);
    return row;
  }

  async create(dto: CreateToolDto): Promise<ToolDefinitionView> {
    const code = dto.code.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]{1,58}$/.test(code)) {
      throw new BadRequestException('invalid tool code');
    }
    const category = await this.prisma.toolCategory.findUnique({
      where: { code: dto.categoryCode },
    });
    if (!category) throw new BadRequestException('invalid categoryCode');
    const created = await this.prisma.toolDefinition.create({
      data: {
        code,
        name: dto.name.trim(),
        description: dto.description,
        categoryId: category.id,
        executorCode: dto.executorCode.trim(),
        inputSchema: asJson(dto.inputSchema),
        outputSchema: asJson(dto.outputSchema),
        timeoutMs: dto.timeoutMs ?? 15000,
        maxRetries: dto.maxRetries ?? 1,
        roleAccess: dto.roleAccess,
        enabled: dto.enabled ?? true,
        version: dto.version ?? '1.0.0',
        builtin: false,
        config: asJson(dto.config),
      },
      include: { category: true },
    });
    return this.toView(created);
  }

  async update(code: string, dto: UpdateToolDto): Promise<ToolDefinitionView> {
    const existing = await this.getRawByCode(code);
    let categoryId = existing.categoryId;
    if (dto.categoryCode) {
      const category = await this.prisma.toolCategory.findUnique({
        where: { code: dto.categoryCode },
      });
      if (!category) throw new BadRequestException('invalid categoryCode');
      categoryId = category.id;
    }
    const updated = await this.prisma.toolDefinition.update({
      where: { id: existing.id },
      data: {
        name: dto.name?.trim(),
        description: dto.description,
        categoryId,
        inputSchema: dto.inputSchema === undefined ? undefined : asJson(dto.inputSchema),
        outputSchema: dto.outputSchema === undefined ? undefined : asJson(dto.outputSchema),
        timeoutMs: dto.timeoutMs,
        maxRetries: dto.maxRetries,
        roleAccess: dto.roleAccess,
        enabled: dto.enabled,
        version: dto.version,
        config: dto.config === undefined ? undefined : asJson(dto.config),
      },
      include: { category: true },
    });
    return this.toView(updated);
  }

  async setEnabled(code: string, enabled: boolean): Promise<ToolDefinitionView> {
    await this.getRawByCode(code);
    const updated = await this.prisma.toolDefinition.update({
      where: { code },
      data: { enabled },
      include: { category: true },
    });
    return this.toView(updated);
  }

  async remove(code: string): Promise<{ deleted: true; code: string }> {
    const row = await this.getRawByCode(code);
    if (row.builtin) {
      throw new BadRequestException('builtin tools cannot be deleted; disable instead');
    }
    await this.prisma.toolDefinition.delete({ where: { id: row.id } });
    return { deleted: true, code };
  }

  async permissionsMatrix() {
    const tools = await this.list();
    return tools.map((t) => ({
      code: t.code,
      name: t.name,
      enabled: t.enabled,
      roleAccess: t.roleAccess,
      requiredPermission: 'api:tools:execute',
    }));
  }
}
