import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceService } from './workspace.service';
import { RunnerClientService } from './runner-client.service';
import { SecurityPolicyService } from './security-policy.service';
import { DevAuditService } from './audit.service';

@Injectable()
export class TerminalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspaceService,
    private readonly runner: RunnerClientService,
    private readonly policy: SecurityPolicyService,
    private readonly audit: DevAuditService,
  ) {}

  async run(input: {
    workspaceId: number;
    userId: number;
    roleCode: string;
    command: string;
    cwd?: string;
    timeoutMs?: number;
    allowDangerous?: boolean;
  }) {
    await this.workspaces.assertAccess(input.workspaceId, input.userId, input.roleCode, 'editor');
    // Stabilization: terminal never accepts dangerous bypass; use git/dangerous API instead
    this.policy.assertCommandSafe(input.command, false);
    if (/[;&|`$<>]|\n|\r/.test(input.command)) {
      throw new ForbiddenException('shell metacharacters denied');
    }
    const result = await this.runner.terminal({
      workspaceId: input.workspaceId,
      command: input.command,
      cwd: input.cwd,
      timeoutMs: input.timeoutMs,
      allowDangerous: false,
    });
    const row = await this.prisma.devTerminalRun.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        command: input.command,
        cwd: input.cwd,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        stdoutSummary: this.policy.redact(result.stdout || '').slice(0, 4000),
        stderrSummary: this.policy.redact(result.stderr || '').slice(0, 4000),
        status: result.status || (result.ok ? 'ok' : 'error'),
      },
    });
    await this.audit.log({
      userId: input.userId,
      workspaceId: input.workspaceId,
      action: 'terminal.run',
      resource: input.command.slice(0, 120),
      result: row.status,
    });
    return { ...result, id: row.id };
  }
}
