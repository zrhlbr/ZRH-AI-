import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import { BusinessInvokeDto, ListBusinessLogsQueryDto } from './dto/business.dto';
import { BusinessRegistryService } from './registry/business-registry.service';
import { BusinessAccessService } from './access/business-access.service';
import { BusinessAuditService } from './audit/business-audit.service';
import { BusinessHealthService } from './health/business-health.service';
import { BusinessConnectorService } from './connectors/business-connector.service';

/**
 * /api/v1/business/* —— Business Integration Platform（阶段 10）
 * 所有业务执行必须经 Workflow，禁止直连外部系统。
 */
@Controller('business')
export class BusinessController {
  constructor(
    private readonly registry: BusinessRegistryService,
    private readonly access: BusinessAccessService,
    private readonly audit: BusinessAuditService,
    private readonly health: BusinessHealthService,
    private readonly connectors: BusinessConnectorService,
  ) {}

  @Get('health')
  @RequirePermissions('api:business:read')
  healthCheck() {
    return this.health.status();
  }

  @Get('companies')
  @RequirePermissions('api:business:read')
  companies() {
    return this.registry.listCompanies();
  }

  @Get('systems')
  @RequirePermissions('api:business:read')
  systems() {
    return this.registry.list();
  }

  @Get('systems/:code')
  @RequirePermissions('api:business:read')
  system(@Param('code') code: string) {
    return this.registry.getByCode(code);
  }

  @Post('systems/:code/enable')
  @RequirePermissions('api:business:admin')
  enable(@Param('code') code: string) {
    return this.registry.setEnabled(code, true);
  }

  @Post('systems/:code/disable')
  @RequirePermissions('api:business:admin')
  disable(@Param('code') code: string) {
    return this.registry.setEnabled(code, false);
  }

  @Get('connectors')
  @RequirePermissions('api:business:read')
  listConnectors(@Query('systemCode') systemCode?: string) {
    return this.registry.listConnectors(systemCode);
  }

  @Post('connectors/:systemCode/ping')
  @RequirePermissions('api:business:read')
  ping(@Param('systemCode') systemCode: string) {
    return this.connectors.ping(systemCode);
  }

  @Get('workflows')
  @RequirePermissions('api:business:read')
  workflows(@Query('systemCode') systemCode?: string) {
    return this.registry.listWorkflowBindings(systemCode);
  }

  @Get('logs')
  @RequirePermissions('api:business:admin')
  logs(@Query() q: ListBusinessLogsQueryDto) {
    return this.audit.list({
      page: q.page,
      pageSize: q.pageSize,
      systemCode: q.systemCode,
    });
  }

  @Post('invoke')
  @RequirePermissions('api:business:execute')
  @RateLimit({ windowSeconds: 60, maxRequests: 30, keyPrefix: 'business:invoke' })
  invoke(@Body() dto: BusinessInvokeDto, @CurrentUser() user: AuthUser) {
    return this.access.invoke({
      systemCode: dto.systemCode,
      action: dto.action,
      userId: user.id,
      roleCode: user.role,
      inputPayload: dto.input,
    });
  }
}
