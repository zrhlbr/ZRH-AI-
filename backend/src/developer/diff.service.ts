import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceService } from './workspace.service';
import { RunnerClientService } from './runner-client.service';
import { DevAuditService } from './audit.service';
import { SecurityPolicyService } from './security-policy.service';

@Injectable()
export class DiffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspaceService,
    private readonly runner: RunnerClientService,
    private readonly audit: DevAuditService,
    private readonly policy: SecurityPolicyService,
  ) {}

  async create(input: {
    workspaceId: number;
    planId?: number;
    userId: number;
    roleCode: string;
    title: string;
    files: Array<{ path: string; changeType: 'create' | 'modify' | 'delete'; patch: string; content?: string }>;
  }) {
    await this.workspaces.assertAccess(input.workspaceId, input.userId, input.roleCode, 'editor');
    for (const f of input.files) this.policy.assertRelativeSafe(f.path);
    // Stabilization: plan-first — diffs require an approved plan
    if (!input.planId) {
      throw new BadRequestException('planId required — approve a plan before creating diffs');
    }
    const plan = await this.prisma.devPlan.findUnique({ where: { id: input.planId } });
    if (!plan || plan.status !== 'approved') {
      throw new BadRequestException('plan must be approved before creating diffs');
    }
    if (plan.workspaceId !== input.workspaceId) {
      throw new BadRequestException('plan workspace mismatch');
    }
    const diff = await this.prisma.devDiff.create({
      data: {
        workspaceId: input.workspaceId,
        planId: input.planId,
        userId: input.userId,
        title: input.title,
        status: 'pending',
        unifiedSummary: input.files.map((f) => `${f.changeType} ${f.path}`).join('\n'),
        files: {
          create: input.files.map((f) => ({
            path: f.path,
            changeType: f.changeType,
            patch: f.content ? `+++ ${f.path}\n${f.content.split('\n').map((l) => `+${l}`).join('\n')}` : f.patch,
          })),
        },
      },
      include: { files: true },
    });
    await this.audit.log({
      userId: input.userId,
      workspaceId: input.workspaceId,
      action: 'diff.create',
      resource: String(diff.id),
      result: 'ok',
    });
    return diff;
  }

  async get(diffId: number, userId: number, roleCode: string) {
    const diff = await this.prisma.devDiff.findUnique({
      where: { id: diffId },
      include: { files: true },
    });
    if (!diff) throw new BadRequestException('diff not found');
    await this.workspaces.assertAccess(diff.workspaceId, userId, roleCode, 'viewer');
    return diff;
  }

  async approve(diffId: number, userId: number, roleCode: string) {
    const diff = await this.get(diffId, userId, roleCode);
    await this.workspaces.assertAccess(diff.workspaceId, userId, roleCode, 'editor');
    return this.prisma.devDiff.update({
      where: { id: diffId },
      data: { status: 'approved', approvedAt: new Date() },
      include: { files: true },
    });
  }

  async reject(diffId: number, userId: number, roleCode: string) {
    const diff = await this.get(diffId, userId, roleCode);
    await this.workspaces.assertAccess(diff.workspaceId, userId, roleCode, 'editor');
    return this.prisma.devDiff.update({
      where: { id: diffId },
      data: { status: 'rejected' },
      include: { files: true },
    });
  }

  async confirmDelete(diffId: number, fileId: number, userId: number, roleCode: string) {
    const diff = await this.get(diffId, userId, roleCode);
    await this.workspaces.assertAccess(diff.workspaceId, userId, roleCode, 'editor');
    const file = diff.files.find((f) => f.id === fileId);
    if (!file || file.changeType !== 'delete') throw new BadRequestException('not a delete file');
    return this.prisma.devDiffFile.update({
      where: { id: fileId },
      data: { deleteConfirmed: true },
    });
  }

  async apply(diffId: number, userId: number, roleCode: string) {
    const diff = await this.get(diffId, userId, roleCode);
    await this.workspaces.assertAccess(diff.workspaceId, userId, roleCode, 'editor');
    if (diff.status !== 'approved' && diff.status !== 'pending') {
      // allow apply after approve; if still pending require approve first
    }
    if (diff.status !== 'approved') {
      throw new BadRequestException('diff must be approved before apply');
    }
    for (const f of diff.files) {
      if (f.changeType === 'delete' && !f.deleteConfirmed) {
        throw new BadRequestException(`delete of ${f.path} requires second confirmation`);
      }
      const content =
        f.changeType === 'delete'
          ? undefined
          : f.patch
              .split('\n')
              .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
              .map((l) => l.slice(1))
              .join('\n');
      await this.runner.applyPatch({
        workspaceId: diff.workspaceId,
        path: f.path,
        changeType: f.changeType,
        patch: f.patch,
        content,
        deleteConfirmed: f.deleteConfirmed,
      });
    }
    const updated = await this.prisma.devDiff.update({
      where: { id: diffId },
      data: { status: 'applied', appliedAt: new Date() },
      include: { files: true },
    });
    if (diff.planId) {
      await this.prisma.devPlan.update({
        where: { id: diff.planId },
        data: { status: 'executed', executedAt: new Date() },
      });
    }
    await this.audit.log({
      userId,
      workspaceId: diff.workspaceId,
      action: 'diff.apply',
      resource: String(diffId),
      result: 'ok',
    });
    return updated;
  }
}
