import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionAction, PermissionScope, PermissionTargetType } from '../types/knowledge.types';

export interface PermissionCheck {
  userId: number;
  role?: string;
  departmentId?: number;
}

/**
 * Knowledge Permission Service：统一处理文档/文件夹权限。
 * 支持 public / company / department / private / role 五级作用域。
 */
@Injectable()
export class KnowledgePermissionService {
  constructor(private readonly prisma: PrismaService) {}

  private async getUserRole(userId: number): Promise<{ roleCode: string; departmentId?: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    return { roleCode: user?.role?.code ?? 'USER', departmentId: undefined };
  }

  async canAccessDocument(documentId: number, check: PermissionCheck, action: PermissionAction = 'read'): Promise<boolean> {
    const doc = await this.prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
      include: { permissions: true },
    });
    if (!doc) return false;
    if (doc.isDeleted) return false;
    if (doc.ownerId === check.userId) return true;
    if (doc.permission === 'public') return true;
    if (doc.permission === 'company') return true;
    if (doc.permission === 'private') return false;

    const { roleCode } = await this.getUserRole(check.userId);
    if (roleCode === 'SUPER_ADMIN') return true;

    const permissions = doc.permissions;
    const has = (targetType: PermissionTargetType, targetId: number) =>
      permissions.some(
        (p) =>
          p.targetType === targetType &&
          p.targetId === targetId &&
          (p.permission === action || p.permission === 'admin' || (action === 'read' && p.permission === 'write')),
      );

    if (has('user', check.userId)) return true;
    if (doc.permission === 'role' && roleCode && has('role', 0)) {
      // 简化：role 权限目前通过 permission 字段判断，后续可绑定 roleId
      return true;
    }
    if (check.departmentId && doc.permission === 'department' && has('department', check.departmentId)) return true;

    return false;
  }

  async canAccessFolder(folderId: number, check: PermissionCheck): Promise<boolean> {
    const folder = await this.prisma.knowledgeFolder.findUnique({ where: { id: folderId } });
    if (!folder) return false;
    if (folder.ownerId === check.userId) return true;
    if (folder.permission === 'public' || folder.permission === 'company') return true;
    if (folder.permission === 'private') return false;
    const { roleCode } = await this.getUserRole(check.userId);
    if (roleCode === 'SUPER_ADMIN') return true;
    return false;
  }

  /** 构造文档列表过滤条件（用于 Prisma where） */
  async buildDocumentFilter(userId: number): Promise<Prisma.KnowledgeDocumentWhereInput> {
    const { roleCode, departmentId } = await this.getUserRole(userId);
    if (roleCode === 'SUPER_ADMIN') {
      return { isDeleted: false };
    }
    return {
      isDeleted: false,
      OR: [
        { ownerId: userId },
        { permission: { in: ['public', 'company'] } },
        { permission: 'private', ownerId: userId },
        ...(departmentId ? [{ permission: 'department' as const }] : []),
      ],
    };
  }

  async grantPermission(
    documentId: number,
    targetType: PermissionTargetType,
    targetId: number,
    action: PermissionAction,
  ) {
    return this.prisma.documentPermission.upsert({
      where: { documentId_targetType_targetId: { documentId, targetType, targetId } },
      update: { permission: action },
      create: { documentId, targetType, targetId, permission: action },
    });
  }

  async revokePermission(documentId: number, targetType: PermissionTargetType, targetId: number) {
    return this.prisma.documentPermission.deleteMany({
      where: { documentId, targetType, targetId },
    });
  }
}
