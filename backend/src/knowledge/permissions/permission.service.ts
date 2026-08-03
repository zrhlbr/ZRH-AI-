import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { PermissionAction, PermissionScope, PermissionTargetType } from '../types/knowledge.types';

export interface PermissionCheck {
  userId: number;
  role?: string;
  departmentId?: number;
}

/**
 * Knowledge Permission Service：统一处理文档/文件夹权限。
 * Stabilization: align with RAG ACL (department/role require ACL rows).
 */
@Injectable()
export class KnowledgePermissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Feature Freeze: invalidate RAG allow-list cache after ACL mutations */
  async bumpRagAclEpoch() {
    await this.redis.increment('rag:acl:epoch');
  }

  private async getUserRole(userId: number): Promise<{
    roleCode: string;
    roleId: number;
    departmentId?: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    return {
      roleCode: user?.role?.code ?? 'USER',
      roleId: user?.roleId ?? 0,
      departmentId: user?.departmentId ?? undefined,
    };
  }

  async canAccessDocument(
    documentId: number,
    check: PermissionCheck,
    action: PermissionAction = 'read',
  ): Promise<boolean> {
    const doc = await this.prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
      include: { permissions: true },
    });
    if (!doc || doc.isDeleted) return false;
    if (doc.ownerId === check.userId) return true;

    const { roleCode, roleId, departmentId } = await this.getUserRole(check.userId);
    if (roleCode === 'SUPER_ADMIN') return true;

    // Stabilization R2: public/company are read-scoped for non-owners
    if (doc.permission === 'public' || doc.permission === 'company') {
      return action === 'read';
    }

    const deptId = check.departmentId ?? departmentId;
    const permissions = doc.permissions;
    const allows = (p: { permission: string }) =>
      p.permission === action ||
      p.permission === 'admin' ||
      (action === 'read' && p.permission === 'write');

    // Feature Freeze: private docs may still grant via explicit ACL rows (align list/search/RAG)
    if (permissions.some((p) => p.targetType === 'user' && p.targetId === check.userId && allows(p))) {
      return true;
    }
    if (
      roleId > 0 &&
      permissions.some((p) => p.targetType === 'role' && p.targetId === roleId && allows(p))
    ) {
      return true;
    }
    if (
      deptId &&
      permissions.some((p) => p.targetType === 'department' && p.targetId === deptId && allows(p))
    ) {
      return true;
    }
    return false;
  }

  async canAccessFolder(
    folderId: number,
    check: PermissionCheck,
    action: 'read' | 'write' = 'read',
  ): Promise<boolean> {
    const folder = await this.prisma.knowledgeFolder.findUnique({ where: { id: folderId } });
    if (!folder) return false;
    if (folder.ownerId === check.userId) return true;
    const { roleCode, roleId, departmentId } = await this.getUserRole(check.userId);
    if (roleCode === 'SUPER_ADMIN' || roleCode === 'ADMIN') return true;
    // Feature Freeze: company/public folders are read-open; write owner/admin only
    if (folder.permission === 'public' || folder.permission === 'company') {
      return action === 'read';
    }
    if (folder.permission === 'private') return false;
    // department/role folders inherit owner principal (no folder ACL table)
    if (folder.permission === 'department') {
      const owner = await this.prisma.user.findUnique({
        where: { id: folder.ownerId },
        select: { departmentId: true },
      });
      const deptId = check.departmentId ?? departmentId;
      const ok = !!deptId && !!owner?.departmentId && deptId === owner.departmentId;
      return ok && action === 'read';
    }
    if (folder.permission === 'role') {
      const owner = await this.prisma.user.findUnique({
        where: { id: folder.ownerId },
        select: { roleId: true },
      });
      const ok = roleId > 0 && !!owner?.roleId && roleId === owner.roleId;
      return ok && action === 'read';
    }
    return false;
  }

  /** 构造文档列表过滤条件（用于 Prisma where） */
  async buildDocumentFilter(userId: number): Promise<Prisma.KnowledgeDocumentWhereInput> {
    const { roleCode, roleId, departmentId } = await this.getUserRole(userId);
    if (roleCode === 'SUPER_ADMIN') {
      return { isDeleted: false };
    }

    const or: Prisma.KnowledgeDocumentWhereInput[] = [
      { ownerId: userId },
      { permission: { in: ['public', 'company'] } },
      {
        permissions: {
          some: {
            targetType: 'user',
            targetId: userId,
            permission: { in: ['read', 'write', 'admin'] },
          },
        },
      },
    ];

    if (roleId > 0) {
      or.push({
        permissions: {
          some: {
            targetType: 'role',
            targetId: roleId,
            permission: { in: ['read', 'write', 'admin'] },
          },
        },
      });
      or.push({
        AND: [
          { permission: 'role' },
          {
            permissions: {
              some: {
                targetType: 'role',
                targetId: roleId,
                permission: { in: ['read', 'write', 'admin'] },
              },
            },
          },
        ],
      });
    }

    if (departmentId) {
      or.push({
        AND: [
          { permission: 'department' },
          {
            permissions: {
              some: {
                targetType: 'department',
                targetId: departmentId,
                permission: { in: ['read', 'write', 'admin'] },
              },
            },
          },
        ],
      });
      // Align with RAG: bare department ACL rows also grant list visibility
      or.push({
        permissions: {
          some: {
            targetType: 'department',
            targetId: departmentId,
            permission: { in: ['read', 'write', 'admin'] },
          },
        },
      });
    }

    return { isDeleted: false, OR: or };
  }

  async grantPermission(
    documentId: number,
    targetType: PermissionTargetType,
    targetId: number,
    action: PermissionAction,
    actorUserId?: number,
  ) {
    if (actorUserId !== undefined) {
      const { roleCode } = await this.getUserRole(actorUserId);
      const platformAdmin = roleCode === 'ADMIN' || roleCode === 'SUPER_ADMIN';
      const ok =
        platformAdmin || (await this.canAccessDocument(documentId, { userId: actorUserId }, 'admin'));
      if (!ok) throw new ForbiddenException('no permission to grant');
    }
    const row = await this.prisma.documentPermission.upsert({
      where: { documentId_targetType_targetId: { documentId, targetType, targetId } },
      update: { permission: action },
      create: { documentId, targetType, targetId, permission: action },
    });
    await this.bumpRagAclEpoch();
    return row;
  }

  async revokePermission(
    documentId: number,
    targetType: PermissionTargetType,
    targetId: number,
    actorUserId?: number,
  ) {
    if (actorUserId !== undefined) {
      const { roleCode } = await this.getUserRole(actorUserId);
      const platformAdmin = roleCode === 'ADMIN' || roleCode === 'SUPER_ADMIN';
      const ok =
        platformAdmin || (await this.canAccessDocument(documentId, { userId: actorUserId }, 'admin'));
      if (!ok) throw new ForbiddenException('no permission to revoke');
    }
    const result = await this.prisma.documentPermission.deleteMany({
      where: { documentId, targetType, targetId },
    });
    await this.bumpRagAclEpoch();
    return result;
  }
}
