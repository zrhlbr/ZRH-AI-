import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemService } from '../../system/system.service';
import { McpRegistryService } from '../registry/mcp-registry.service';
import { McpSessionView } from '../types/mcp.types';

/**
 * MCP Gateway — Session / Transport / Health.
 * P2: filesystem/git → Dev Runner; docker/postgres/github → mediated gateway adapters.
 */
@Injectable()
export class McpGatewayService {
  private readonly logger = new Logger(McpGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: McpRegistryService,
    private readonly system: SystemService,
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

    const session = await this.prisma.mcpSession.create({
      data: {
        serverId: server.id,
        userId: input.userId,
        status: 'connected',
        metadata: {
          ...(input.metadata ?? {}),
          transport: server.transport,
          stub: server.transport === 'stub' || server.reserved,
          note: 'MCP gateway session',
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

    this.logger.log(`MCP connect session ${session.id} -> ${server.code}`);
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

  async invokeStub(serverCode: string, action: string, payload?: Record<string, unknown>) {
    return this.invoke(serverCode, action, payload);
  }

  /**
   * MCP invoke — filesystem/git/docker/postgres/github routed via Gateway.
   * Execution for fs/git goes through Dev Runner when DEV_RUNNER_URL is set.
   */
  async invoke(
    serverCode: string,
    action: string,
    payload?: Record<string, unknown>,
    roleCode?: string,
  ) {
    const server = await this.registry.getRawByCode(serverCode);
    const started = Date.now();
    const body = payload ?? {};
    const effectiveRole = roleCode ?? 'USER';
    if (!this.registry.canAccess(server, effectiveRole)) {
      throw new BadRequestException(`role ${effectiveRole} cannot access MCP ${server.code}`);
    }

    try {
      if (serverCode === 'filesystem' || serverCode === 'git') {
        const runnerUrl = (process.env.DEV_RUNNER_URL || '').replace(/\/$/, '');
        const token = process.env.DEV_RUNNER_TOKEN || '';
        if (!runnerUrl || !token) {
          throw new BadRequestException('DEV_RUNNER_URL / DEV_RUNNER_TOKEN required for filesystem/git MCP');
        }
        const workspaceId = Number(body.workspaceId);
        const userId = Number(body.userId);
        if (!workspaceId) {
          throw new BadRequestException('workspaceId required for filesystem/git MCP');
        }
        if (!userId) {
          throw new BadRequestException('userId required for filesystem/git MCP');
        }
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: { role: true },
        });
        const isSuper = user?.role?.code === 'SUPER_ADMIN';
        if (!isSuper) {
          const allowed = await this.prisma.devWorkspace.findFirst({
            where: {
              id: workspaceId,
              OR: [{ ownerUserId: userId }, { members: { some: { userId } } }],
            },
            select: { id: true },
          });
          if (!allowed) {
            throw new BadRequestException('workspace access denied');
          }
        }
        let path = '/fs/tree';
        let reqBody: Record<string, unknown> = { workspaceId };
        if (serverCode === 'filesystem') {
          if (action === 'read') {
            path = '/fs/read';
            reqBody = { workspaceId, path: body.path };
          } else if (action === 'search') {
            path = '/search/content';
            reqBody = { workspaceId, query: body.query };
          } else {
            // tree | list | default
            path = '/fs/tree';
          }
        } else {
          const dangerous = ['reset-hard', 'clean', 'push-force'];
          if (dangerous.includes(action)) {
            throw new BadRequestException(
              'dangerous git ops are not allowed via MCP; use Developer git API',
            );
          }
          const readWrite = ['status', 'diff', 'log', 'branches', 'commit', 'revert'];
          if (!readWrite.includes(action)) {
            throw new BadRequestException(`git action not allowed via MCP: ${action}`);
          }
          path = '/git';
          reqBody = { workspaceId, op: action, message: body.message, sha: body.sha };
        }
        const res = await fetch(`${runnerUrl}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Runner-Token': token },
          body: JSON.stringify(reqBody),
          signal: AbortSignal.timeout(60000),
        });
        const result = await res.json();
        await this.prisma.mcpRunLog.create({
          data: {
            serverId: server.id,
            userId: Number(body.userId) || 0,
            action: `${action}`,
            status: res.ok ? 'success' : 'error',
            detail: `via dev-runner`,
            latencyMs: Date.now() - started,
          },
        });
        return {
          serverCode: server.code,
          transport: 'runner',
          reserved: false,
          action,
          result,
          message: 'MCP invoke via ZRH Dev Runner',
        };
      }

      if (serverCode === 'docker') {
        const docker = await this.system.docker();
        await this.prisma.mcpRunLog.create({
          data: {
            serverId: server.id,
            userId: Number(body.userId) || 0,
            action,
            status: 'success',
            detail: 'via system.docker',
            latencyMs: Date.now() - started,
          },
        });
        return {
          serverCode,
          transport: 'gateway',
          reserved: false,
          action,
          result: { action, docker },
          message: 'Docker MCP mediated via System module (no docker.sock on runner)',
        };
      }

      if (serverCode === 'postgres' || serverCode === 'postgresql') {
        const tables = await this.prisma.$queryRawUnsafe<
          Array<{ table_schema: string; table_name: string }>
        >(
          `SELECT table_schema, table_name FROM information_schema.tables
           WHERE table_schema NOT IN ('pg_catalog','information_schema')
           ORDER BY table_schema, table_name LIMIT 200`,
        );
        await this.prisma.mcpRunLog.create({
          data: {
            serverId: server.id,
            userId: Number(body.userId) || 0,
            action,
            status: 'success',
            detail: 'read-only metadata',
            latencyMs: Date.now() - started,
          },
        });
        return {
          serverCode,
          transport: 'gateway',
          reserved: false,
          action,
          result: {
            action,
            mode: 'read-only-metadata',
            tables: tables.map((t) => `${t.table_schema}.${t.table_name}`),
          },
          message: 'PostgreSQL MCP read-only metadata via Gateway',
        };
      }

      if (serverCode === 'github') {
        const token = process.env.GITHUB_TOKEN || '';
        if (!token) {
          await this.prisma.mcpRunLog.create({
            data: {
              serverId: server.id,
              userId: Number(body.userId) || 0,
              action,
              status: 'error',
              detail: 'GITHUB_TOKEN missing',
              latencyMs: Date.now() - started,
            },
          });
          return {
            serverCode,
            transport: 'gateway',
            reserved: true,
            action,
            result: null,
            message: 'GitHub MCP reserved — set GITHUB_TOKEN to enable',
          };
        }
        const ghAction = action || 'user';
        let url = 'https://api.github.com/user';
        if (ghAction === 'repos') {
          url = 'https://api.github.com/user/repos?per_page=20';
        } else if (ghAction === 'repo' && body.owner && body.repo) {
          url = `https://api.github.com/repos/${encodeURIComponent(String(body.owner))}/${encodeURIComponent(String(body.repo))}`;
        }
        const res = await fetch(url, {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'User-Agent': 'ZRH-AI-MCP-Gateway',
          },
          signal: AbortSignal.timeout(20000),
        });
        const text = await res.text();
        let data: unknown = text;
        try {
          data = JSON.parse(text);
        } catch {
          // keep text
        }
        await this.prisma.mcpRunLog.create({
          data: {
            serverId: server.id,
            userId: Number(body.userId) || 0,
            action: ghAction,
            status: res.ok ? 'success' : 'error',
            detail: `HTTP ${res.status}`,
            latencyMs: Date.now() - started,
          },
        });
        return {
          serverCode,
          transport: 'gateway',
          reserved: false,
          action: ghAction,
          result: { ok: res.ok, status: res.status, data },
          message: 'GitHub MCP via official REST API',
        };
      }

      return {
        serverCode: server.code,
        transport: server.transport,
        reserved: server.reserved,
        action,
        payload: body,
        result: null,
        message: 'MCP connector reserved — framework only',
      };
    } catch (err) {
      await this.prisma.mcpRunLog.create({
        data: {
          serverId: server.id,
          userId: Number(body.userId) || 0,
          action,
          status: 'error',
          detail: err instanceof Error ? err.message : String(err),
          latencyMs: Date.now() - started,
        },
      });
      throw err;
    }
  }
}
