import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import {
  CreateToolDto,
  ExecuteToolDto,
  ListToolLogsQueryDto,
  ListToolsQueryDto,
  RouteToolDto,
  ToolCallDto,
  UpdateToolDto,
} from './dto/tool.dto';
import { ToolRegistryService } from './registry/tool-registry.service';
import { ToolRuntimeService } from './runtime/tool-runtime.service';
import { ToolCallingService } from './calling/tool-calling.service';
import { ToolRouterService } from './router/tool-router.service';
import { ToolLogsService } from './logs/tool-logs.service';
import { ToolHealthService } from './health/tool-health.service';

/**
 * /api/v1/tools/* —— Tool Calling Platform（阶段 8）
 */
@Controller('tools')
export class ToolsController {
  constructor(
    private readonly registry: ToolRegistryService,
    private readonly runtime: ToolRuntimeService,
    private readonly calling: ToolCallingService,
    private readonly router: ToolRouterService,
    private readonly logs: ToolLogsService,
    private readonly health: ToolHealthService,
  ) {}

  @Get('health')
  @RequirePermissions('api:tools:read')
  healthCheck() {
    return this.health.status();
  }

  @Get('categories')
  @RequirePermissions('api:tools:read')
  categories() {
    return this.registry.listCategories();
  }

  @Get('permissions')
  @RequirePermissions('api:tools:read')
  permissions() {
    return this.registry.permissionsMatrix();
  }

  @Get('logs')
  @RequirePermissions('api:tools:admin')
  listLogs(@Query() q: ListToolLogsQueryDto) {
    return this.logs.list({
      page: q.page,
      pageSize: q.pageSize,
      toolCode: q.toolCode,
    });
  }

  @Get('route')
  @RequirePermissions('api:tools:read')
  async route(@Query() q: RouteToolDto) {
    const result = await this.router.route({
      task: q.task,
      agentCode: q.agentCode,
    });
    return {
      toolCode: result.plan.toolCode,
      args: result.plan.args,
      reason: result.plan.reason,
      candidates: result.candidates.map((c) => ({
        code: c.code,
        name: c.name,
        categoryCode: c.categoryCode,
      })),
    };
  }

  @Get()
  @RequirePermissions('api:tools:read')
  list(@Query() q: ListToolsQueryDto) {
    return this.registry.list({ enabled: q.enabled, category: q.category });
  }

  @Get(':code')
  @RequirePermissions('api:tools:read')
  get(@Param('code') code: string) {
    return this.registry.getByCode(code);
  }

  @Post()
  @RequirePermissions('api:tools:admin')
  create(@Body() dto: CreateToolDto) {
    return this.registry.create(dto);
  }

  @Patch(':code')
  @RequirePermissions('api:tools:admin')
  update(@Param('code') code: string, @Body() dto: UpdateToolDto) {
    return this.registry.update(code, dto);
  }

  @Post(':code/enable')
  @RequirePermissions('api:tools:admin')
  enable(@Param('code') code: string) {
    return this.registry.setEnabled(code, true);
  }

  @Post(':code/disable')
  @RequirePermissions('api:tools:admin')
  disable(@Param('code') code: string) {
    return this.registry.setEnabled(code, false);
  }

  @Delete(':code')
  @RequirePermissions('api:tools:admin')
  remove(@Param('code') code: string) {
    return this.registry.remove(code);
  }

  @Post('execute')
  @RequirePermissions('api:tools:execute')
  @RateLimit({ windowSeconds: 60, maxRequests: 60, keyPrefix: 'tools:execute' })
  execute(@Body() dto: ExecuteToolDto, @CurrentUser() user: AuthUser) {
    return this.runtime.execute({
      toolCode: dto.toolCode,
      userId: user.id,
      roleCode: user.role,
      args: dto.args,
      mode: dto.mode,
      agentCode: dto.agentCode,
    });
  }

  @Post('call')
  @RequirePermissions('api:tools:execute')
  @RateLimit({ windowSeconds: 60, maxRequests: 30, keyPrefix: 'tools:call' })
  call(@Body() dto: ToolCallDto, @CurrentUser() user: AuthUser) {
    return this.calling.call({
      userId: user.id,
      roleCode: user.role,
      message: dto.message,
      agentCode: dto.agentCode,
      toolCode: dto.toolCode,
      args: dto.args,
    });
  }
}
