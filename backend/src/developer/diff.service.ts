import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceService } from './workspace.service';
import { RunnerClientService } from './runner-client.service';
import { DevAuditService, DevAuditMeta } from './audit.service';
import { SecurityPolicyService } from './security-policy.service';

function sha256(text: string): string {
  return createHash('sha256').update(text ?? '').digest('hex');
}

@Injectable()
export class DiffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspaceService,
    private readonly runner: RunnerClientService,
    private readonly audit: DevAuditService,
    private readonly policy: SecurityPolicyService,
  ) {}

  private contentFromPatch(patch: string): string {
    return patch
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      .map((l) => l.slice(1))
      .join('\n');
  }

  async create(input: {
    workspaceId: number;
    planId?: number;
    userId: number;
    roleCode: string;
    title: string;
    files: Array<{ path: string; changeType: 'create' | 'modify' | 'delete'; patch: string; content?: string; baseSha?: string }>;
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

    // Phase 0.5: full content is mandatory for writes; patch-only replay is
    // no longer an accepted production path. Capture base SHA for integrity.
    const files = [] as Array<{
      path: string;
      changeType: 'create' | 'modify' | 'delete';
      patch: string;
      baseSha?: string;
    }>;
    for (const f of input.files) {
      if (f.changeType !== 'delete' && f.content == null) {
        throw new BadRequestException(`full content required for ${f.path} (patch-only diffs disabled in Phase 0.5)`);
      }
      let baseSha = f.baseSha;
      if (!baseSha) {
        try {
          const cur = await this.runner.readFile(input.workspaceId, f.path);
          baseSha = cur.sha256 || sha256(cur.content);
        } catch {
          baseSha = undefined; // file does not exist yet
        }
      }
      files.push({
        path: f.path,
        changeType: f.changeType,
        patch: f.content
          ? `+++ ${f.path}\n${f.content.split('\n').map((l) => `+${l}`).join('\n')}`
          : f.patch,
        baseSha,
      });
    }

    const diff = await this.prisma.devDiff.create({
      data: {
        workspaceId: input.workspaceId,
        planId: input.planId,
        userId: input.userId,
        title: input.title,
        status: 'pending',
        unifiedSummary: files.map((f) => `${f.changeType} ${f.path}`).join('\n'),
        files: {
          create: files.map((f) => ({
            path: f.path,
            changeType: f.changeType,
            patch: f.patch,
            baseSha: f.baseSha,
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
      meta: { diffId: diff.id, planId: input.planId, files: files.map((f) => f.path) },
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

  /**
   * Phase 0.5 transactional apply:
   * validate all → snapshot all → write all → record after-SHA;
   * any failure rolls every written file back to its snapshot.
   */
  async apply(diffId: number, userId: number, roleCode: string, ctx?: { ip?: string; userAgent?: string }) {
    const started = Date.now();
    const diff = await this.get(diffId, userId, roleCode);
    await this.workspaces.assertAccess(diff.workspaceId, userId, roleCode, 'editor');
    if (diff.status !== 'approved') {
      throw new BadRequestException('diff must be approved before apply');
    }
    // Plan must be approved (defense in depth; create() already enforces)
    if (diff.planId) {
      const plan = await this.prisma.devPlan.findUnique({ where: { id: diff.planId } });
      if (!plan || plan.status !== 'approved') {
        throw new BadRequestException('plan must be approved before apply');
      }
    }

    // ---- Step 1: validate ALL files (delete confirmations, SHA conflicts) ----
    const conflicts: string[] = [];
    const prepared: Array<{
      fileId: number;
      path: string;
      changeType: string;
      content?: string;
      existed: boolean;
      beforeContent: string;
      beforeSha: string;
    }> = [];
    for (const f of diff.files) {
      if (f.changeType === 'delete' && !f.deleteConfirmed) {
        throw new BadRequestException(`delete of ${f.path} requires second confirmation`);
      }
      let current: { content: string } | null = null;
      try {
        current = await this.runner.readFile(diff.workspaceId, f.path);
      } catch {
        current = null;
      }
      const beforeContent = current?.content ?? '';
      const beforeSha = sha256(beforeContent);
      // SHA conflict: file changed since the diff was created → refuse silently overwriting
      if (f.baseSha && current && beforeSha !== f.baseSha) {
        conflicts.push(f.path);
        continue;
      }
      if (f.baseSha && !current && f.changeType === 'modify') {
        conflicts.push(`${f.path} (missing)`);
        continue;
      }
      prepared.push({
        fileId: f.id,
        path: f.path,
        changeType: f.changeType,
        content: f.changeType === 'delete' ? undefined : this.contentFromPatch(f.patch),
        existed: !!current,
        beforeContent,
        beforeSha,
      });
    }
    if (conflicts.length) {
      await this.audit.log({
        userId,
        workspaceId: diff.workspaceId,
        action: 'diff.apply',
        resource: String(diffId),
        result: 'conflict',
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
        meta: { diffId, errorCode: 'SHA_CONFLICT', files: conflicts },
      });
      throw new ConflictException(`SHA conflict — file changed since diff creation: ${conflicts.join(', ')}`);
    }

    // ---- Step 2: snapshot ALL files before writing ----
    await this.prisma.devSnapshot.createMany({
      data: prepared.map((p) => ({
        workspaceId: diff.workspaceId,
        diffId: diff.id,
        path: p.path,
        sha256: p.beforeSha,
        existed: p.existed,
        content: p.existed ? p.beforeContent : null,
      })),
    });

    // ---- Step 3: write ALL; on any failure roll everything back ----
    const written: typeof prepared = [];
    const afterSha: Record<string, string> = {};
    try {
      for (const p of prepared) {
        await this.runner.applyPatch({
          workspaceId: diff.workspaceId,
          path: p.path,
          changeType: p.changeType,
          content: p.content,
          deleteConfirmed: p.changeType === 'delete' ? true : undefined,
        });
        written.push(p);
        if (p.changeType !== 'delete') {
          const cur = await this.runner.readFile(diff.workspaceId, p.path);
          afterSha[p.path] = cur.sha256 || sha256(cur.content);
          await this.prisma.devDiffFile.update({
            where: { id: p.fileId },
            data: { afterSha: afterSha[p.path], status: 'applied' },
          });
        } else {
          afterSha[p.path] = '';
          await this.prisma.devDiffFile.update({
            where: { id: p.fileId },
            data: { afterSha: '', status: 'applied' },
          });
        }
      }
    } catch (err) {
      // Roll back written files from snapshots
      const rollbackErrors: string[] = [];
      for (const p of written.reverse()) {
        try {
          await this.runner.applyPatch({
            workspaceId: diff.workspaceId,
            path: p.path,
            changeType: p.existed ? 'modify' : 'delete',
            content: p.existed ? p.beforeContent : undefined,
            deleteConfirmed: !p.existed,
          });
        } catch (rbErr) {
          rollbackErrors.push(`${p.path}: ${rbErr instanceof Error ? rbErr.message : String(rbErr)}`);
        }
      }
      await this.prisma.devDiff.update({ where: { id: diffId }, data: { status: 'failed' } });
      await this.audit.log({
        userId,
        workspaceId: diff.workspaceId,
        action: 'diff.apply',
        resource: String(diffId),
        result: 'error',
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
        meta: {
          diffId,
          errorCode: 'APPLY_FAILED_ROLLED_BACK',
          files: written.map((w) => w.path),
          detail: err instanceof Error ? err.message : String(err),
          rollbackErrors: rollbackErrors.length ? rollbackErrors : undefined,
          durationMs: Date.now() - started,
        },
      });
      throw new BadRequestException(
        `apply failed and was rolled back: ${err instanceof Error ? err.message : String(err)}${
          rollbackErrors.length ? `; rollback errors: ${rollbackErrors.join('; ')}` : ''
        }`,
      );
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
    const meta: DevAuditMeta = {
      diffId,
      planId: diff.planId ?? undefined,
      files: prepared.map((p) => p.path),
      beforeSha: Object.fromEntries(prepared.map((p) => [p.path, p.beforeSha])),
      afterSha,
      durationMs: Date.now() - started,
    };
    await this.audit.log({
      userId,
      workspaceId: diff.workspaceId,
      action: 'diff.apply',
      resource: String(diffId),
      result: 'ok',
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
      meta,
    });
    return updated;
  }

  /** Roll back an applied diff to its pre-apply snapshots. */
  async rollback(diffId: number, userId: number, roleCode: string, ctx?: { ip?: string; userAgent?: string }) {
    const diff = await this.get(diffId, userId, roleCode);
    await this.workspaces.assertAccess(diff.workspaceId, userId, roleCode, 'editor');
    if (diff.status !== 'applied') {
      throw new BadRequestException(`diff status is ${diff.status}; only applied diffs can be rolled back`);
    }
    const snapshots = await this.prisma.devSnapshot.findMany({
      where: { diffId },
      orderBy: { id: 'desc' },
    });
    if (!snapshots.length) {
      throw new BadRequestException('no snapshots found for this diff');
    }
    const restored: string[] = [];
    for (const s of snapshots) {
      await this.runner.applyPatch({
        workspaceId: diff.workspaceId,
        path: s.path,
        changeType: s.existed ? 'modify' : 'delete',
        content: s.existed ? (s.content ?? '') : undefined,
        deleteConfirmed: !s.existed,
      });
      restored.push(s.path);
    }
    await this.prisma.devDiffFile.updateMany({ where: { diffId }, data: { status: 'rolled-back' } });
    const updated = await this.prisma.devDiff.update({
      where: { id: diffId },
      data: { status: 'rolled-back' },
      include: { files: true },
    });
    await this.audit.log({
      userId,
      workspaceId: diff.workspaceId,
      action: 'diff.rollback',
      resource: String(diffId),
      result: 'ok',
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
      meta: { diffId, files: restored },
    });
    return updated;
  }
}
