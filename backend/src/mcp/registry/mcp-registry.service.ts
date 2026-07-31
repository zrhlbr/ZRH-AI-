import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMcpServerDto } from '../dto/mcp.dto';
import { McpServerView } from '../types/mcp.types';

@Injectable()
export class McpRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  private toView(row: {
    id: number;
    code: string;
    name: string;
    description: string | null;
    transport: string;
    endpoint: string | null;
    enabled: boolean;
    status: string;
    version: string;
    builtin: boolean;
    reserved: boolean;
    roleAccess: string | null;
    config: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): McpServerView {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      transport: row.transport,
      endpoint: row.endpoint,
      enabled: row.enabled,
      status: row.status,
      version: row.version,
      builtin: row.builtin,
      reserved: row.reserved,
      roleAccess: row.roleAccess,
      config: row.config,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  canAccess(server: { roleAccess: string | null }, roleCode: string): boolean {
    if (!server.roleAccess) return true;
    try {
      const roles = JSON.parse(server.roleAccess) as string[];
      if (!Array.isArray(roles) || roles.length === 0) return true;
      return roles.includes(roleCode);
    } catch {
      return server.roleAccess.split(',').map((s) => s.trim()).includes(roleCode);
    }
  }

  async list(opts: { enabled?: boolean; status?: string } = {}): Promise<McpServerView[]> {
    const rows = await this.prisma.mcpServer.findMany({
      where: {
        ...(opts.enabled !== undefined ? { enabled: opts.enabled } : {}),
        ...(opts.status ? { status: opts.status } : {}),
      },
      orderBy: [{ name: 'asc' }],
    });
    return rows.map((r) => this.toView(r));
  }

  async getByCode(code: string): Promise<McpServerView> {
    const row = await this.prisma.mcpServer.findUnique({ where: { code } });
    if (!row) throw new NotFoundException(`mcp server not found: ${code}`);
    return this.toView(row);
  }

  async getRawByCode(code: string) {
    const row = await this.prisma.mcpServer.findUnique({ where: { code } });
    if (!row) throw new NotFoundException(`mcp server not found: ${code}`);
    return row;
  }

  async update(code: string, dto: UpdateMcpServerDto): Promise<McpServerView> {
    await this.getRawByCode(code);
    const updated = await this.prisma.mcpServer.update({
      where: { code },
      data: {
        name: dto.name?.trim(),
        description: dto.description,
        transport: dto.transport,
        endpoint: dto.endpoint,
        enabled: dto.enabled,
        version: dto.version,
        roleAccess: dto.roleAccess,
        config: dto.config === undefined ? undefined : (dto.config as Prisma.InputJsonValue),
        status: dto.enabled === false ? 'offline' : undefined,
      },
    });
    return this.toView(updated);
  }

  async setEnabled(code: string, enabled: boolean): Promise<McpServerView> {
    const row = await this.getRawByCode(code);
    if (row.reserved && enabled) {
      // 预留连接器可启用框架状态，但仍为 stub transport
      const updated = await this.prisma.mcpServer.update({
        where: { code },
        data: {
          enabled: true,
          status: 'offline',
          transport: row.transport || 'stub',
        },
      });
      return this.toView(updated);
    }
    const updated = await this.prisma.mcpServer.update({
      where: { code },
      data: {
        enabled,
        status: enabled ? row.status : 'offline',
      },
    });
    return this.toView(updated);
  }

  async remove(code: string): Promise<{ deleted: true; code: string }> {
    const row = await this.getRawByCode(code);
    if (row.builtin) {
      throw new BadRequestException('builtin MCP servers cannot be deleted; disable instead');
    }
    await this.prisma.mcpServer.delete({ where: { id: row.id } });
    return { deleted: true, code };
  }
}
