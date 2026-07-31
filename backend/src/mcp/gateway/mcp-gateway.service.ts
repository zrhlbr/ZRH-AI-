import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { McpRegistryService } from '../registry/mcp-registry.service';
import { McpSessionView } from '../types/mcp.types';

/**
 * MCP Gateway（框架）：统一 Session / Transport / Health。
 * Stage 8 连接器为 stub/reserved，后续逐步实现真实协议。
 */
@Injectable()
export class McpGatewayService {
  private readonly logger = new Logger(McpGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: McpRegistryService,
  ) {}

  private toSessionView(row: {
    id: number;
    userId: number;
    status: string;
    metadata: unknown;
    startedAt: Date;
    endedAt: Date | null;
    server: { code: string; name: string };
  }): McpSessionView {
    return {
      id: row.id,
      serverCode: row.server.code,
      serverName: row.server.name,
      userId: row.userId,
      status: row.status,
      metadata: row.metadata,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
    };
  }

  async connect(input: {
    serverCode: string;
    userId: number;
    roleCode: string;
    metadata?: Record<string, unknown>;
  }): Promise<McpSessionView> {
    const started = Date.now();
    const server = await this.registry.getRawByCode(input.serverCode);
    if (!this.registry.canAccess(server, input.roleCode)) {
      throw new BadRequestException(`role ${input.roleCode} cannot access MCP ${server.code}`);
    }
    if (!server.enabled) {
      throw new BadRequestException(
        `MCP server disabled (reserved stub): ${server.code}. Enable in registry first.`,
      );
    }

    // stub transport：创建会话但不建立真实外部连接
    const session = await this.prisma.mcpSession.create({
      data: {
        serverId: server.id,
        userId: input.userId,
        status: 'connected',
        metadata: {
          ...(input.metadata ?? {}),
          transport: server.transport,
          stub: server.transport === 'stub' || server.reserved,
          note: 'Stage 8 framework session; connector implementation pending',
        } as Prisma.InputJsonValue,
      },
      include: { server: { select: { code: true, name: true } } },
    });

    await this.prisma.mcpServer.update({
      where: { id: server.id },
      data: { status: server.reserved || server.transport === 'stub' ? 'reserved' : 'online' },
    });

    await this.prisma.mcpRunLog.create({
      data: {
        serverId: server.id,
        userId: input.userId,
        action: 'connect',
        status: 'success',
        detail: `session=${session.id}; transport=${server.transport}`,
        latencyMs: Date.now() - started,
      },
    });

    this.logger.log(`MCP connect stub session ${session.id} -> ${server.code}`);
    return this.toSessionView(session);
  }

  async disconnect(input: {
    userId: number;
    sessionId?: number;
    serverCode?: string;
  }): Promise<{ disconnected: number }> {
    const started = Date.now();
    const where = {
      userId: input.userId,
      status: 'connected',
      ...(input.sessionId ? { id: input.sessionId } : {}),
      ...(input.serverCode ? { server: { code: input.serverCode } } : {}),
    };
    const sessions = await this.prisma.mcpSession.findMany({
      where,
      include: { server: true },
    });
    if (!sessions.length) {
      throw new BadRequestException('no active session to disconnect');
    }

    await this.prisma.mcpSession.updateMany({
      where: { id: { in: sessions.map((s) => s.id) } },
      data: { status: 'disconnected', endedAt: new Date() },
    });

    for (const s of sessions) {
      const remaining = await this.prisma.mcpSession.count({
        where: { serverId: s.serverId, status: 'connected' },
      });
      if (remaining === 0) {
        await this.prisma.mcpServer.update({
          where: { id: s.serverId },
          data: { status: s.server.reserved ? 'reserved' : 'offline' },
        });
      }
      await this.prisma.mcpRunLog.create({
        data: {
          serverId: s.serverId,
          userId: input.userId,
          action: 'disconnect',
          status: 'success',
          detail: `session=${s.id}`,
          latencyMs: Date.now() - started,
        },
      });
    }

    return { disconnected: sessions.length };
  }

  async listSessions(userId?: number): Promise<McpSessionView[]> {
    const rows = await this.prisma.mcpSession.findMany({
      where: {
        status: 'connected',
        ...(userId ? { userId } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
      include: { server: { select: { code: true, name: true } } },
    });
    return rows.map((r) => this.toSessionView(r));
  }

  /** Client stub：调用预留连接器（返回框架响应） */
  async invokeStub(serverCode: string, action: string, payload?: Record<string, unknown>) {
    const server = await this.registry.getRawByCode(serverCode);
    return {
      serverCode: server.code,
      transport: server.transport,
      reserved: server.reserved,
      action,
      payload: payload ?? {},
      result: null,
      message: 'MCP connector reserved — framework only in Stage 8',
    };
  }
}
