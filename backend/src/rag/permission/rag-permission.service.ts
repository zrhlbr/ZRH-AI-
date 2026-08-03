import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

export interface RagPrincipal {
  userId: number;
  roleId: number;
  roleCode: string;
  departmentId?: number | null;
}

/**
 * Stage 6 RAG Permission Filter。
 * 真正按 private / company / department / role / public 过滤可检索文档，禁止越权。
 */
@Injectable()
export class RagPermissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async resolvePrincipal(userId: number): Promise<RagPrincipal> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    return {
      userId,
      roleId: user?.roleId ?? 0,
      roleCode: user?.role?.code ?? 'USER',
      departmentId: user?.departmentId ?? null,
    };
  }

  /** 构造可检索文档 where（用于 Prisma） */
  buildAccessibleDocumentWhere(principal: RagPrincipal): Prisma.KnowledgeDocumentWhereInput {
    if (principal.roleCode === 'SUPER_ADMIN') {
      return { isDeleted: false, status: { in: ['indexed', 'chunked', 'embedding'] } };
    }

    const or: Prisma.KnowledgeDocumentWhereInput[] = [
      { ownerId: principal.userId },
      { permission: 'public' },
      { permission: 'company' },
      {
        permissions: {
          some: {
            targetType: 'user',
            targetId: principal.userId,
            permission: { in: ['read', 'write', 'admin'] },
          },
        },
      },
    ];

    if (principal.roleId > 0) {
      or.push({
        AND: [
          { permission: 'role' },
          {
            permissions: {
              some: {
                targetType: 'role',
                targetId: principal.roleId,
                permission: { in: ['read', 'write', 'admin'] },
              },
            },
          },
        ],
      });
      // 角色授权也可挂在 document_permissions，即使 scope 不是 role
      or.push({
        permissions: {
          some: {
            targetType: 'role',
            targetId: principal.roleId,
            permission: { in: ['read', 'write', 'admin'] },
          },
        },
      });
    }

    if (principal.departmentId) {
      or.push({
        AND: [
          { permission: 'department' },
          {
            permissions: {
              some: {
                targetType: 'department',
                targetId: principal.departmentId,
                permission: { in: ['read', 'write', 'admin'] },
              },
            },
          },
        ],
      });
      or.push({
        permissions: {
          some: {
            targetType: 'department',
            targetId: principal.departmentId,
            permission: { in: ['read', 'write', 'admin'] },
          },
        },
      });
    }

    return {
      isDeleted: false,
      status: { in: ['indexed', 'chunked', 'embedding'] },
      OR: or,
    };
  }

  /** Feature Freeze: bump when document ACL changes so stale allow-lists cannot linger */
  async bumpAclEpoch(): Promise<void> {
    await this.redis.increment('rag:acl:epoch');
  }

  private async aclEpoch(): Promise<number> {
    const v = await this.redis.get('rag:acl:epoch');
    const n = Number(v ?? '0');
    return Number.isFinite(n) ? n : 0;
  }

  async listAccessibleDocumentIds(userId: number, limit = 5000): Promise<number[]> {
    const epoch = await this.aclEpoch();
    const cacheKey = `rag:acl:v2:${epoch}:${userId}:${limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        const ids = JSON.parse(cached) as number[];
        if (Array.isArray(ids)) return ids;
      } catch {
        // ignore
      }
    }
    const principal = await this.resolvePrincipal(userId);
    const docs = await this.prisma.knowledgeDocument.findMany({
      where: this.buildAccessibleDocumentWhere(principal),
      select: { id: true },
      orderBy: { id: 'asc' },
      take: limit,
    });
    const ids = docs.map((d) => d.id);
    await this.redis.setex(cacheKey, Number(process.env.RAG_ACL_CACHE_TTL_SEC ?? '45'), JSON.stringify(ids));
    return ids;
  }

  async assertCanReadDocument(userId: number, documentId: number): Promise<boolean> {
    const principal = await this.resolvePrincipal(userId);
    if (principal.roleCode === 'SUPER_ADMIN') {
      const doc = await this.prisma.knowledgeDocument.findFirst({
        where: { id: documentId, isDeleted: false },
        select: { id: true },
      });
      return !!doc;
    }
    const doc = await this.prisma.knowledgeDocument.findFirst({
      where: {
        id: documentId,
        ...this.buildAccessibleDocumentWhere(principal),
      },
      select: { id: true },
    });
    return !!doc;
  }

  /** 从候选 hits 中剔除越权文档 */
  async filterHitsByPermission<T extends { documentId: number }>(
    userId: number,
    hits: T[],
  ): Promise<T[]> {
    if (hits.length === 0) return hits;
    const allowed = new Set(await this.listAccessibleDocumentIds(userId));
    return hits.filter((h) => allowed.has(h.documentId));
  }
}
