import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceService } from './workspace.service';
import { DevAuditService } from './audit.service';

@Injectable()
export class PlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspaceService,
    private readonly audit: DevAuditService,
  ) {}

  async create(input: {
    workspaceId: number;
    sessionId?: number;
    userId: number;
    roleCode: string;
    title: string;
    summary: string;
    steps: Array<{ action: string; path?: string; detail?: string; riskLevel?: string }>;
    riskLevel?: string;
  }) {
    await this.workspaces.assertAccess(input.workspaceId, input.userId, input.roleCode, 'viewer');
    const plan = await this.prisma.devPlan.create({
      data: {
        workspaceId: input.workspaceId,
        sessionId: input.sessionId,
        userId: input.userId,
        title: input.title,
        summary: input.summary,
        status: 'pending',
        riskLevel: input.riskLevel || 'medium',
        steps: {
          create: input.steps.map((s, i) => ({
            ord: i + 1,
            action: s.action,
            path: s.path,
            detail: s.detail,
            riskLevel: s.riskLevel || 'low',
          })),
        },
      },
      include: { steps: { orderBy: { ord: 'asc' } } },
    });
    await this.audit.log({
      userId: input.userId,
      workspaceId: input.workspaceId,
      action: 'plan.create',
      resource: String(plan.id),
      result: 'ok',
    });
    return plan;
  }

  async get(planId: number, userId: number, roleCode: string) {
    const plan = await this.prisma.devPlan.findUnique({
      where: { id: planId },
      include: { steps: { orderBy: { ord: 'asc' } }, diffs: true },
    });
    if (!plan) throw new BadRequestException('plan not found');
    await this.workspaces.assertAccess(plan.workspaceId, userId, roleCode, 'viewer');
    return plan;
  }

  async list(workspaceId: number, userId: number, roleCode: string) {
    await this.workspaces.assertAccess(workspaceId, userId, roleCode, 'viewer');
    return this.prisma.devPlan.findMany({
      where: { workspaceId },
      include: { steps: { orderBy: { ord: 'asc' } } },
      orderBy: { id: 'desc' },
      take: 50,
    });
  }

  async approve(planId: number, userId: number, roleCode: string) {
    const plan = await this.get(planId, userId, roleCode);
    await this.workspaces.assertAccess(plan.workspaceId, userId, roleCode, 'editor');
    if (plan.status !== 'pending' && plan.status !== 'draft') {
      throw new BadRequestException(`plan status is ${plan.status}`);
    }
    const updated = await this.prisma.devPlan.update({
      where: { id: planId },
      data: { status: 'approved', approvedAt: new Date() },
      include: { steps: true },
    });
    await this.audit.log({
      userId,
      workspaceId: plan.workspaceId,
      action: 'plan.approve',
      resource: String(planId),
      result: 'ok',
    });
    return updated;
  }

  async reject(planId: number, userId: number, roleCode: string) {
    const plan = await this.get(planId, userId, roleCode);
    await this.workspaces.assertAccess(plan.workspaceId, userId, roleCode, 'editor');
    const updated = await this.prisma.devPlan.update({
      where: { id: planId },
      data: { status: 'rejected', rejectedAt: new Date() },
      include: { steps: true },
    });
    await this.audit.log({
      userId,
      workspaceId: plan.workspaceId,
      action: 'plan.reject',
      resource: String(planId),
      result: 'ok',
    });
    return updated;
  }
}
