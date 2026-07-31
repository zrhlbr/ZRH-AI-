import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessSystemView } from '../types/business.types';

@Injectable()
export class BusinessRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  private toView(row: {
    id: number;
    code: string;
    name: string;
    description: string | null;
    kind: string;
    enabled: boolean;
    status: string;
    version: string;
    readOnlyDefault: boolean;
    writeRequiresApproval: boolean;
    roleAccess: string | null;
    companyCode: string | null;
    connectors: Array<{
      code: string;
      name: string;
      transport: string;
      enabled: boolean;
      status: string;
      healthStatus: string;
    }>;
    workflows: Array<{
      actionCode: string;
      workflowCode: string;
      name: string;
      isDefault: boolean;
      requiresApproval: boolean;
      readOnly: boolean;
    }>;
  }): BusinessSystemView {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      kind: row.kind,
      enabled: row.enabled,
      status: row.status,
      version: row.version,
      readOnlyDefault: row.readOnlyDefault,
      writeRequiresApproval: row.writeRequiresApproval,
      roleAccess: row.roleAccess,
      companyCode: row.companyCode,
      connectors: row.connectors,
      workflows: row.workflows,
    };
  }

  canAccess(system: { roleAccess: string | null }, roleCode: string): boolean {
    if (!system.roleAccess) return true;
    if (roleCode === 'SUPER_ADMIN') return true;
    try {
      const roles = JSON.parse(system.roleAccess) as string[];
      if (!Array.isArray(roles) || roles.length === 0) return true;
      return roles.includes(roleCode);
    } catch {
      return system.roleAccess.split(',').map((s) => s.trim()).includes(roleCode);
    }
  }

  async listCompanies() {
    return this.prisma.company.findMany({ orderBy: { code: 'asc' } });
  }

  async list(): Promise<BusinessSystemView[]> {
    const rows = await this.prisma.businessSystem.findMany({
      orderBy: { name: 'asc' },
      include: { connectors: true, workflows: true },
    });
    return rows.map((r) => this.toView(r));
  }

  async getByCode(code: string): Promise<BusinessSystemView> {
    const row = await this.prisma.businessSystem.findUnique({
      where: { code },
      include: { connectors: true, workflows: true },
    });
    if (!row) throw new NotFoundException(`business system not found: ${code}`);
    return this.toView(row);
  }

  async getRawByCode(code: string) {
    const row = await this.prisma.businessSystem.findUnique({
      where: { code },
      include: { connectors: true, workflows: true },
    });
    if (!row) throw new NotFoundException(`business system not found: ${code}`);
    return row;
  }

  async listConnectors(systemCode?: string) {
    return this.prisma.businessConnector.findMany({
      where: systemCode ? { system: { code: systemCode } } : {},
      include: { system: { select: { code: true, name: true } } },
      orderBy: { id: 'asc' },
    });
  }

  async listWorkflowBindings(systemCode?: string) {
    return this.prisma.businessSystemWorkflow.findMany({
      where: systemCode ? { system: { code: systemCode } } : {},
      include: { system: { select: { code: true, name: true } } },
      orderBy: { id: 'asc' },
    });
  }

  async setEnabled(code: string, enabled: boolean) {
    await this.getRawByCode(code);
    const updated = await this.prisma.businessSystem.update({
      where: { code },
      data: { enabled, status: enabled ? 'online' : 'offline' },
      include: { connectors: true, workflows: true },
    });
    return this.toView(updated);
  }

  async resolveAction(systemCode: string, action: string) {
    const system = await this.getRawByCode(systemCode);
    if (!system.enabled) throw new BadRequestException('business system disabled');
    const binding = system.workflows.find((w) => w.actionCode === action);
    if (!binding) {
      throw new BadRequestException(`action not mapped for ${systemCode}: ${action}`);
    }
    return { system, binding };
  }
}
