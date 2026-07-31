import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowRuntimeService } from '../../workflows/runtime/workflow-runtime.service';
import { BusinessRegistryService } from '../registry/business-registry.service';
import { BusinessConnectorService } from '../connectors/business-connector.service';
import { BusinessAuditService } from '../audit/business-audit.service';
import { BusinessInvokeResult } from '../types/business.types';

const ARCH =
  'Business → Workflow → Agent Center → Tool Manager → MCP Gateway → Business Connector → Business System';

/**
 * 业务访问唯一入口：强制先跑 Workflow，再读 Connector Stub。
 */
@Injectable()
export class BusinessAccessService {
  private readonly logger = new Logger(BusinessAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: BusinessRegistryService,
    private readonly connectors: BusinessConnectorService,
    private readonly workflows: WorkflowRuntimeService,
    private readonly audit: BusinessAuditService,
  ) {}

  async invoke(input: {
    systemCode: string;
    action: string;
    userId: number;
    roleCode: string;
    inputPayload?: Record<string, unknown>;
  }): Promise<BusinessInvokeResult> {
    const { system, binding } = await this.registry.resolveAction(
      input.systemCode,
      input.action,
    );
    if (!this.registry.canAccess(system, input.roleCode)) {
      throw new BadRequestException(`role ${input.roleCode} cannot access ${system.code}`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { departmentId: true },
    });

    // 写操作：不得在 Connector 直写；必须走审批 Workflow
    if (!binding.readOnly || binding.requiresApproval) {
      if (!system.writeRequiresApproval && !binding.requiresApproval) {
        throw new BadRequestException('write path misconfigured');
      }
    }

    this.logger.log(
      `business invoke system=${system.code} action=${binding.actionCode} workflow=${binding.workflowCode}`,
    );

    const run = await this.workflows.execute({
      code: binding.workflowCode,
      userId: input.userId,
      roleCode: input.roleCode,
      inputPayload: {
        ...(input.inputPayload ?? {}),
        businessSystem: system.code,
        businessAction: binding.actionCode,
      },
      mode: 'sync',
      trigger: 'manual',
    });

    let connectorPayload: unknown = null;
    let status = run.status;

    if (run.status === 'success' && binding.readOnly) {
      connectorPayload = await this.connectors.read(
        system.code,
        binding.actionCode,
        input.inputPayload ?? {},
      );
      await this.connectors.ping(system.code);
    } else if (run.status === 'waiting_approval') {
      connectorPayload = {
        reserved: true,
        message: 'Write/config operation waiting for approval workflow',
        writeBlockedAtConnector: true,
      };
    } else if (!binding.readOnly) {
      // 审批拒绝/取消等：仍不开放 connector 写
      connectorPayload = {
        reserved: true,
        message: 'Write operation is not executed at connector layer',
        workflowStatus: run.status,
      };
    }

    await this.audit.log({
      systemId: system.id,
      userId: input.userId,
      action: binding.actionCode,
      workflowCode: binding.workflowCode,
      workflowRunId: run.id,
      status,
      detail: `latency=${run.latencyMs}ms; readOnly=${binding.readOnly}`,
      departmentId: user?.departmentId ?? undefined,
      companyCode: system.companyCode ?? undefined,
    });

    return {
      systemCode: system.code,
      action: binding.actionCode,
      workflowCode: binding.workflowCode,
      workflowRunId: run.id,
      workflowStatus: status,
      connector: connectorPayload,
      readOnly: binding.readOnly,
      requiresApproval: binding.requiresApproval,
      architecture: ARCH,
    };
  }
}
