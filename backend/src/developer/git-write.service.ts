import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceService } from './workspace.service';
import { RunnerClientService } from './runner-client.service';
import { DevAuditService } from './audit.service';
import { SecurityPolicyService } from './security-policy.service';

@Injectable()
export class GitWriteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspaceService,
    private readonly runner: RunnerClientService,
    private readonly audit: DevAuditService,
    private readonly policy: SecurityPolicyService,
  ) {}

  async commit(workspaceId: number, userId: number, roleCode: string, message: string) {
    await this.workspaces.assertAccess(workspaceId, userId, roleCode, 'editor');
    const result = await this.runner.git({ workspaceId, op: 'commit', message });
    await this.prisma.devGitOp.create({
      data: {
        workspaceId,
        userId,
        op: 'commit',
        args: message,
        status: result.ok ? 'ok' : 'error',
        detail: this.policy.redact(result.stderr || result.stdout || '').slice(0, 2000),
      },
    });
    await this.audit.log({
      userId,
      workspaceId,
      action: 'git.commit',
      result: result.ok ? 'ok' : 'error',
    });
    return result;
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
    return result;
  }

  async dangerous(
    workspaceId: number,
    userId: number,
    roleCode: string,
    op: 'reset-hard' | 'clean' | 'push-force',
    confirmed: boolean,
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
      throw new ForbiddenException('dangerous git op requires confirmed=true');
    }
    if (op === 'push-force') {
      // still allowed only with confirmation; never default
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
    });
    return result;
  }
}
