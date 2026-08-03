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
  ApprovalDto,
  CopyWorkflowDto,
  CreateScheduleDto,
  CreateWorkflowDto,
  ExecuteWorkflowDto,
  ImportWorkflowDto,
  ListHistoryQueryDto,
  ListWorkflowsQueryDto,
  UpdateWorkflowDto,
} from './dto/workflow.dto';
import { WorkflowRegistryService } from './registry/workflow-registry.service';
import { WorkflowRuntimeService } from './runtime/workflow-runtime.service';
import { WorkflowSchedulerService } from './scheduler/workflow-scheduler.service';
import { WorkflowHistoryService } from './history/workflow-history.service';
import { WorkflowHealthService } from './health/workflow-health.service';

/**
 * /api/v1/workflows/* —— Workflow Engine（阶段 9）
 * 静态路由必须写在 :code 参数路由之前。
 */
@Controller('workflows')
export class WorkflowsController {
  constructor(
    private readonly registry: WorkflowRegistryService,
    private readonly runtime: WorkflowRuntimeService,
    private readonly scheduler: WorkflowSchedulerService,
    private readonly history: WorkflowHistoryService,
    private readonly health: WorkflowHealthService,
  ) {}

  @Get('health')
  @RequirePermissions('api:workflows:read')
  healthCheck() {
    return this.health.status();
  }

  @Get('categories')
  @RequirePermissions('api:workflows:read')
  categories() {
    return this.registry.listCategories();
  }

  @Get('templates')
  @RequirePermissions('api:workflows:read')
  templates() {
    return this.registry.listTemplates();
  }

  @Get('history')
  @RequirePermissions('api:workflows:read')
  listHistory(@Query() q: ListHistoryQueryDto, @CurrentUser() user: AuthUser) {
    return this.history.list({
      page: q.page,
      pageSize: q.pageSize,
      workflowCode: q.workflowCode,
      status: q.status,
      userId: user.id,
      roleCode: user.role,
    });
  }

  @Get('history/:id')
  @RequirePermissions('api:workflows:read')
  getHistory(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.history.get(Number(id), { userId: user.id, roleCode: user.role });
  }

  @Get('logs')
  @RequirePermissions('api:workflows:admin')
  listLogs(@Query() q: ListHistoryQueryDto) {
    return this.history.listLogs({
      page: q.page,
      pageSize: q.pageSize,
      workflowCode: q.workflowCode,
    });
  }

  @Get('scheduler')
  @RequirePermissions('api:workflows:read')
  listSchedules() {
    return this.scheduler.list();
  }

  @Post('scheduler')
  @RequirePermissions('api:workflows:admin')
  createSchedule(@Body() dto: CreateScheduleDto, @CurrentUser() user: AuthUser) {
    return this.scheduler.create(dto, user.id);
  }

  @Post('scheduler/:id/enable')
  @RequirePermissions('api:workflows:admin')
  enableSchedule(@Param('id') id: string) {
    return this.scheduler.setEnabled(Number(id), true);
  }

  @Post('scheduler/:id/disable')
  @RequirePermissions('api:workflows:admin')
  disableSchedule(@Param('id') id: string) {
    return this.scheduler.setEnabled(Number(id), false);
  }

  @Delete('scheduler/:id')
  @RequirePermissions('api:workflows:admin')
  removeSchedule(@Param('id') id: string) {
    return this.scheduler.remove(Number(id));
  }

  @Get('runs/:id')
  @RequirePermissions('api:workflows:read')
  getRun(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.runtime.getRun(Number(id), { userId: user.id, roleCode: user.role });
  }

  @Post('runs/:id/pause')
  @RequirePermissions('api:workflows:execute')
  pause(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.runtime.pause(Number(id), user.id, user.role);
  }

  @Post('runs/:id/resume')
  @RequirePermissions('api:workflows:execute')
  resume(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.runtime.resume(Number(id), user.id, user.role);
  }

  @Post('runs/:id/cancel')
  @RequirePermissions('api:workflows:execute')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.runtime.cancel(Number(id), user.id, user.role);
  }

  @Post('runs/:id/approve')
  @RequirePermissions('api:workflows:execute')
  approve(
    @Param('id') id: string,
    @Body() dto: ApprovalDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.runtime.approve(Number(id), user.id, dto.approved, dto.comment, user.role);
  }

  @Post('execute')
  @RequirePermissions('api:workflows:execute')
  @RateLimit({ windowSeconds: 60, maxRequests: 20, keyPrefix: 'workflows:execute' })
  execute(@Body() dto: ExecuteWorkflowDto, @CurrentUser() user: AuthUser) {
    return this.runtime.execute({
      code: dto.code,
      workflowId: dto.workflowId,
      userId: user.id,
      roleCode: user.role,
      inputPayload: dto.input,
      mode: dto.mode,
      trigger: 'manual',
    });
  }

  @Post('import')
  @RequirePermissions('api:workflows:admin')
  importDefinition(@Body() dto: ImportWorkflowDto) {
    return this.registry.import(dto);
  }

  @Get()
  @RequirePermissions('api:workflows:read')
  list(@Query() q: ListWorkflowsQueryDto) {
    return this.registry.list({
      enabled: q.enabled,
      template: q.template,
      category: q.category,
    });
  }

  @Post()
  @RequirePermissions('api:workflows:admin')
  create(@Body() dto: CreateWorkflowDto) {
    return this.registry.create(dto);
  }

  @Get(':code/export')
  @RequirePermissions('api:workflows:read')
  export(@Param('code') code: string) {
    return this.registry.export(code);
  }

  @Post(':code/copy')
  @RequirePermissions('api:workflows:admin')
  copy(@Param('code') code: string, @Body() dto: CopyWorkflowDto) {
    return this.registry.copy(code, dto);
  }

  @Post(':code/enable')
  @RequirePermissions('api:workflows:admin')
  enable(@Param('code') code: string) {
    return this.registry.setEnabled(code, true);
  }

  @Post(':code/disable')
  @RequirePermissions('api:workflows:admin')
  disable(@Param('code') code: string) {
    return this.registry.setEnabled(code, false);
  }

  @Post(':code/trigger')
  @RequirePermissions('api:workflows:execute')
  trigger(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.scheduler.triggerNow(code, user.id, user.role);
  }

  @Get(':code')
  @RequirePermissions('api:workflows:read')
  get(@Param('code') code: string) {
    return this.registry.getByCode(code);
  }

  @Patch(':code')
  @RequirePermissions('api:workflows:admin')
  update(@Param('code') code: string, @Body() dto: UpdateWorkflowDto) {
    return this.registry.update(code, dto);
  }

  @Delete(':code')
  @RequirePermissions('api:workflows:admin')
  remove(@Param('code') code: string) {
    return this.registry.remove(code);
  }
}
