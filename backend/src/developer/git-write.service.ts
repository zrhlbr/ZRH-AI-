import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceService } from './workspace.service';
import { RunnerClientService } from './runner-client.service';
import { DevAuditService } from './audit.service';
import { SecurityPolicyService } from './security-policy.service';

/**
 * Phase 0.5 — Git write plane with precise-whitelist staging.
 * Commits may only contain files from the newest applied diff of the
 * workspace. `git add -A` / `git add .` / `git commit -a` do not exist here.
 */
@Injectable()
export class GitWriteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspaceService,
    private readonly runner: RunnerClientService,
    private readonly audit: DevAuditService,
    private readonly policy: SecurityPolicyService,
  ) {}

  /** Exact file whitelist from the newest applied diff. */
  private async commitWhitelist(workspaceId: number): Promise<{ diffId: number; files: string[] }> {
    const diff = await this.prisma.devDiff.findFirst({
      where: { workspaceId, status: 'applied' },
      orderBy: { appliedAt: 'desc' },
      include: { files: true },
    });
    if (!diff || !diff.files.length) {
      throw new BadRequestException(
        'no applied diff found — commit requires an approved+applied diff as the file whitelist',
      );
    }
    return { diffId: diff.id, files: diff.files.map((f) => f.path) };
  }

  /**
   * Two-step commit:
   *  - confirmed=false: stage exactly the whitelist, verify, return staged diff (nothing committed)
   *  - confirmed=true : re-verify staged set matches the whitelist, commit, return full SHA
   */
  async commit(
    workspaceId: number,
    userId: number,
    roleCode: string,
    message: string,
    confirmed = false,
    ctx?: { ip?: string; userAgent?: string },
  ) {
    await this.workspaces.assertAccess(workspaceId, userId, roleCode, 'editor');
    const { diffId, files } = await this.commitWhitelist(workspaceId);

    const result = await this.runner.git({ workspaceId, op: 'commit', message, files, confirmed });

    await this.prisma.devGitOp.create({
      data: {
        workspaceId,
        userId,
        op: confirmed ? 'commit' : 'commit-stage',
        args: message,
        status: result.ok ? 'ok' : 'error',
        detail: this.policy
          .redact(
            (result as { stagedDiff?: string; stderr?: string; stdout?: string }).stagedDiff ||
              (result as { stderr?: string }).stderr ||
              (result as { stdout?: string }).stdout ||
              '',
          )
          .slice(0, 2000),
      },
    });
    await this.audit.log({
      userId,
      workspaceId,
      action: confirmed ? 'git.commit' : 'git.commit.stage',
      result: result.ok ? 'ok' : 'error',
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
      meta: {
        diffId,
        files,
        confirmation: confirmed ? 'confirmed' : 'staged-awaiting-confirmation',
        commitSha: (result as { commitSha?: string }).commitSha,
      },
    });
    return { ...result, whitelistDiffId: diffId, files };
  }

  async revert(workspaceId: number, userId: number, roleCode: string, sha: string) {
    await this.workspaces.assertAccess(workspaceId, userId, roleCode, 'editor');
    const result = await this.runner.git({ workspaceId, op: 'revert', sha });
    await this.prisma.devGitOp.create({
      data: {
        workspaceId,
        userId,
        op: 'revert',
        args: sha,
        status: result.ok ? 'ok' : 'error',
        detail: this.policy.redact(result.stderr || '').slice(0, 2000),
      },
    });
    await this.audit.log({
      userId,
      workspaceId,
      action: 'git.revert',
      result: result.ok ? 'ok' : 'error',
      meta: { commitSha: sha },
    });
    return result;
  }

  async dangerous(
    workspaceId: number,
    userId: number,
    roleCode: string,
    op: 'reset-hard' | 'clean' | 'push-force',
    confirmed: boolean,
    ctx?: { ip?: string; userAgent?: string },
  ) {
    await this.workspaces.assertAccess(workspaceId, userId, roleCode, 'owner');
    if (!confirmed) {
      await this.prisma.devGitOp.create({
        data: {
          workspaceId,
          userId,
          op,
          status: 'denied',
          detail: 'second confirmation required',
        },
      });
      await this.audit.log({
        userId,
        workspaceId,
        action: `git.${op}`,
        result: 'denied',
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
        meta: { confirmation: 'missing' },
      });
      throw new ForbiddenException('dangerous git op requires confirmed=true');
    }
    const result = await this.runner.git({ workspaceId, op, confirmed: true });
    await this.prisma.devGitOp.create({
      data: {
        workspaceId,
        userId,
        op,
        status: result.ok ? 'ok' : 'error',
        detail: this.policy.redact(result.stderr || result.stdout || '').slice(0, 2000),
      },
    });
    await this.audit.log({
      userId,
      workspaceId,
      action: `git.${op}`,
      result: result.ok ? 'ok' : 'error',
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
      meta: { confirmation: 'confirmed' },
    });
    return result;
  }
}
