import { Module } from '@nestjs/common';
import { WorkflowsModule } from '../workflows/workflows.module';
import { BusinessController } from './business.controller';
import { BusinessRegistryService } from './registry/business-registry.service';
import { BusinessConnectorService } from './connectors/business-connector.service';
import { BusinessAccessService } from './access/business-access.service';
import { BusinessAuditService } from './audit/business-audit.service';
import { BusinessHealthService } from './health/business-health.service';

/**
 * Stage 10 Business Integration Platform。
 * 业务访问唯一路径：Business → Workflow → Agent → Tool → MCP → Connector。
 * 不修改 AI Gateway；资金写操作仅审批预留。
 */
@Module({
  imports: [WorkflowsModule],
  controllers: [BusinessController],
  providers: [
    BusinessRegistryService,
    BusinessConnectorService,
    BusinessAccessService,
    BusinessAuditService,
    BusinessHealthService,
  ],
  exports: [BusinessRegistryService, BusinessAccessService],
})
export class BusinessModule {}
