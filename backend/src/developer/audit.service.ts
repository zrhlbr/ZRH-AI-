import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityPolicyService } from './security-policy.service';

/**
 * Phase 0.5 structured audit context. Secret-shaped values are redacted
 * before persisting; .env contents / tokens / passwords / private keys /
 * SMTP secrets must never be passed in by callers.
 */
export interface DevAuditMeta {
  role?: string;
  sessionId?: number;
  planId?: number;
  diffId?: number;
  command?: string;
  files?: string[];
  beforeSha?: Record<string, string>;
  afterSha?: Record<string, string>;
  commitSha?: string;
  confirmation?: string;
  durationMs?: number;
  errorCode?: string;
  [key: string]: unknown;
}

@Injectable()
export class DevAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: SecurityPolicyService,
  ) {}

  private redactMeta(meta?: DevAuditMeta): Prisma.InputJsonValue | undefined {
    if (!meta) return undefined;
    try {
      const redacted = this.policy.redact(JSON.stringify(meta)).slice(0, 8000);
      return JSON.parse(redacted) as Prisma.InputJsonValue;
    } catch {
      return { note: 'meta redaction fallback' } as Prisma.InputJsonValue;
    }
  }

  async log(input: {
    userId: number;
    workspaceId?: number | null;
    action: string;
    resource?: string;
    result: string;
    detail?: string;
    ip?: string;
    userAgent?: string;
    meta?: DevAuditMeta;
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
        userAgent: input.userAgent?.slice(0, 300),
        meta: this.redactMeta(input.meta),
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
