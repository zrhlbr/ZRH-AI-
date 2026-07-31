import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { McpRegistryService } from '../registry/mcp-registry.service';
import { McpGatewayService } from '../gateway/mcp-gateway.service';

@Injectable()
export class McpHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: McpRegistryService,
    private readonly gateway: McpGatewayService,
  ) {}

  async status() {
    const [servers, sessions, errors24h, totalLogs] = await Promise.all([
      this.registry.list(),
      this.gateway.listSessions(),
      this.prisma.mcpRunLog.count({
        where: {
          status: 'error',
          createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
        },
      }),
      this.prisma.mcpRunLog.count(),
    ]);
    return {
      servers: {
        total: servers.length,
        enabled: servers.filter((s) => s.enabled).length,
        reserved: servers.filter((s) => s.reserved).length,
        online: servers.filter((s) => s.status === 'online').length,
      },
      sessions: {
        active: sessions.length,
      },
      logs: {
        total: totalLogs,
        errors24h,
      },
      gateway: 'ok',
      ok: servers.length >= 10,
    };
  }
}
