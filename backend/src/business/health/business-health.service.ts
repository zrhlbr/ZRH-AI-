import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessRegistryService } from '../registry/business-registry.service';

@Injectable()
export class BusinessHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: BusinessRegistryService,
  ) {}

  async status() {
    const [systems, connectors, audits24h, recent] = await Promise.all([
      this.registry.list(),
      this.prisma.businessConnector.count({ where: { enabled: true } }),
      this.prisma.businessAuditLog.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
      }),
      this.prisma.businessAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { system: { select: { code: true, name: true } } },
      }),
    ]);
    const online = systems.filter((s) => s.enabled && s.status === 'online');
    const healthyConnectors = await this.prisma.businessConnector.count({
      where: { healthStatus: 'healthy' },
    });
    return {
      systems: {
        total: systems.length,
        online: online.length,
        kinds: [...new Set(systems.map((s) => s.kind))],
      },
      connectors: {
        enabled: connectors,
        healthy: healthyConnectors,
      },
      audits24h,
      recent,
      architecture:
        'Business → Workflow → Agent Center → Tool Manager → MCP Gateway → Business Connector',
      ok: systems.length >= 5 && online.length >= 5,
    };
  }
}
