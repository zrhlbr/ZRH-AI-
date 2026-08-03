import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RunnerClientService } from './runner-client.service';
import { SecurityPolicyService } from './security-policy.service';
import { DevAuditService } from './audit.service';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: RunnerClientService,
    private readonly policy: SecurityPolicyService,
    private readonly audit: DevAuditService,
  ) {}

  private slugify(name: string) {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || `ws-${Date.now()}`
    );
  }

  async assertAccess(workspaceId: number, userId: number, roleCode: string, min: 'viewer' | 'editor' | 'owner' = 'viewer') {
    const ws = await this.prisma.devWorkspace.findUnique({
      where: { id: workspaceId },
      include: { members: true, repo: true },
    });
    if (!ws || ws.status === 'disabled') throw new NotFoundException('workspace not found');
    if (roleCode === 'SUPER_ADMIN') return ws;
    const member = ws.members.find((m) => m.userId === userId);
    if (!member && ws.ownerUserId !== userId) throw new ForbiddenException('workspace access denied');
    const role = member?.role || (ws.ownerUserId === userId ? 'owner' : 'viewer');
    const rank = { viewer: 1, editor: 2, owner: 3 } as const;
    if (rank[role as keyof typeof rank] < rank[min]) {
      throw new ForbiddenException('insufficient workspace role');
    }
    return ws;
  }

  async list(userId: number, roleCode: string) {
    if (roleCode === 'SUPER_ADMIN' || roleCode === 'ADMIN') {
      return this.prisma.devWorkspace.findMany({
        include: { repo: true, members: true },
        orderBy: { id: 'asc' },
        take: 200,
      });
    }
    return this.prisma.devWorkspace.findMany({
      where: {
        OR: [{ ownerUserId: userId }, { members: { some: { userId } } }],
      },
      include: { repo: true, members: true },
      orderBy: { id: 'asc' },
    });
  }

  async create(
    userId: number,
    input: { name: string; kind?: 'bind' | 'git'; rootPath?: string; remoteUrl?: string; description?: string },
  ) {
    const slug = this.slugify(input.name);
    const rootPath = (input.rootPath || slug).replace(/\\/g, '/');
    this.policy.assertRelativeSafe(rootPath);
    const ws = await this.prisma.devWorkspace.create({
      data: {
        name: input.name,
        slug,
        kind: input.kind || (input.remoteUrl ? 'git' : 'bind'),
        rootPath,
        description: input.description,
        ownerUserId: userId,
        members: { create: { userId, role: 'owner' } },
        repo: input.remoteUrl
          ? { create: { remoteUrl: input.remoteUrl } }
          : { create: {} },
      },
      include: { repo: true, members: true },
    });
    await this.runner.ensureWorkspace({
      workspaceId: ws.id,
      kind: ws.kind,
      remoteUrl: input.remoteUrl,
    });
    await this.audit.log({
      userId,
      workspaceId: ws.id,
      action: 'workspace.create',
      resource: ws.slug,
      result: 'ok',
    });
    return ws;
  }

  async get(workspaceId: number, userId: number, roleCode: string) {
    return this.assertAccess(workspaceId, userId, roleCode, 'viewer');
  }

  async tree(workspaceId: number, userId: number, roleCode: string) {
    await this.assertAccess(workspaceId, userId, roleCode, 'viewer');
    return this.runner.tree(workspaceId);
  }

  async readFile(workspaceId: number, userId: number, roleCode: string, filePath: string) {
    await this.assertAccess(workspaceId, userId, roleCode, 'viewer');
    this.policy.assertRelativeSafe(filePath);
    if (this.policy.isEnvPath(filePath)) {
      throw new ForbiddenException('.env files are blocked by default');
    }
    const file = await this.runner.readFile(workspaceId, filePath);
    return { ...file, content: this.policy.redact(file.content) };
  }

  async sync(workspaceId: number, userId: number, roleCode: string) {
    await this.assertAccess(workspaceId, userId, roleCode, 'editor');
    const result = await this.runner.git({ workspaceId, op: 'status' });
    const branchLine = (result.stdout || '').split('\n').find((l) => l.startsWith('##'));
    await this.prisma.devWorkspaceRepo.update({
      where: { workspaceId },
      data: {
        currentBranch: branchLine?.replace('##', '').trim().split('...')[0] || undefined,
        dirty: (result.stdout || '').split('\n').some((l) => l && !l.startsWith('##')),
        lastFetchAt: new Date(),
      },
    });
    await this.audit.log({
      userId,
      workspaceId,
      action: 'workspace.sync',
      result: result.ok ? 'ok' : 'error',
      detail: this.policy.redact(result.stderr || '').slice(0, 2000),
    });
    return result;
  }

  async gitRead(workspaceId: number, userId: number, roleCode: string, op: string) {
    await this.assertAccess(workspaceId, userId, roleCode, 'viewer');
    if (!['status', 'diff', 'log', 'branches'].includes(op)) {
      throw new ForbiddenException('git read op only');
    }
    const result = await this.runner.git({ workspaceId, op });
    await this.prisma.devGitOp.create({
      data: {
        workspaceId,
        userId,
        op,
        status: result.ok ? 'ok' : 'error',
        detail: this.policy.redact((result.stdout || '') + (result.stderr || '')).slice(0, 2000),
      },
    });
    return result;
  }
}
