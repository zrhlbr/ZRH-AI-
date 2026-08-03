import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityPolicyService } from './security-policy.service';

@Injectable()
export class DevAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: SecurityPolicyService,
  ) {}

  async log(input: {
    userId: number;
    workspaceId?: number | null;
    action: string;
    resource?: string;
    result: string;
    detail?: string;
    ip?: string;
  }) {
    return this.prisma.devAuditLog.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId ?? null,
        action: input.action,
        resource: input.resource,
        result: input.result,
        detail: input.detail ? this.policy.redact(input.detail).slice(0, 2000) : undefined,
        ip: input.ip,
      },
    });
  }

  async list(userId: number, workspaceId?: number, isAdmin = false) {
    return this.prisma.devAuditLog.findMany({
      where: {
        ...(workspaceId ? { workspaceId } : {}),
        ...(isAdmin ? {} : { userId }),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
