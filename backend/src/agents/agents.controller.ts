import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import {
  AgentChatDto,
  CreateAgentDto,
  CreateMemoryDto,
  ListAgentsQueryDto,
  ListLogsQueryDto,
  UpdateAgentDto,
} from './dto/agent.dto';
import { AgentRegistryService } from './registry/agent-registry.service';
import { AgentSkillsService } from './skills/agent-skills.service';
import { AgentMemoryService } from './memory/agent-memory.service';
import { AgentRuntimeService } from './runtime/agent-runtime.service';
import { AgentLogsService } from './logs/agent-logs.service';
import { AgentHealthService } from './health/agent-health.service';
import { AgentRouterService } from './router/agent-router.service';

/**
 * /api/v1/agents/* —— Agent Center（阶段 7）
 */
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly registry: AgentRegistryService,
    private readonly skills: AgentSkillsService,
    private readonly memory: AgentMemoryService,
    private readonly runtime: AgentRuntimeService,
    private readonly logs: AgentLogsService,
    private readonly health: AgentHealthService,
    private readonly router: AgentRouterService,
  ) {}

  @Get('health')
  @RequirePermissions('api:agents:read')
  healthCheck() {
    return this.health.status();
  }

  @Get('skills')
  @RequirePermissions('api:agents:read')
  listSkills() {
    return this.skills.list();
  }

  @Get()
  @RequirePermissions('api:agents:read')
  list(@Query() q: ListAgentsQueryDto, @CurrentUser() user: AuthUser) {
    return this.registry.list({
      enabled: q.enabled,
      status: q.status,
      roleCode: user.role,
    });
  }

  @Get('logs')
  @RequirePermissions('api:agents:admin')
  listLogs(@Query() q: ListLogsQueryDto) {
    return this.logs.list({
      page: q.page,
      pageSize: q.pageSize,
      agentCode: q.agentCode,
    });
  }

  @Get('route')
  @RequirePermissions('api:agents:read')
  async route(@Query('q') q: string, @CurrentUser() user: AuthUser) {
    const result = await this.router.route(q ?? '', undefined, user.role);
    return {
      agentCode: result.agent.code,
      agentName: result.agent.name,
      reason: result.reason,
    };
  }

  @Get(':code')
  @RequirePermissions('api:agents:read')
  async get(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    const agent = await this.registry.getByCode(code);
    if (!this.registry.roleAllows(agent.roleAccess, user.role)) {
      throw new ForbiddenException('role cannot view this agent');
    }
    return agent;
  }

  @Post()
  @RequirePermissions('api:agents:write')
  create(@Body() dto: CreateAgentDto) {
    return this.registry.create(dto);
  }

  @Patch(':code')
  @RequirePermissions('api:agents:write')
  update(@Param('code') code: string, @Body() dto: UpdateAgentDto) {
    return this.registry.update(code, dto);
  }

  @Post(':code/enable')
  @RequirePermissions('api:agents:write')
  enable(@Param('code') code: string) {
    return this.registry.setEnabled(code, true);
  }

  @Post(':code/disable')
  @RequirePermissions('api:agents:write')
  disable(@Param('code') code: string) {
    return this.registry.setEnabled(code, false);
  }

  @Delete(':code')
  @RequirePermissions('api:agents:admin')
  remove(@Param('code') code: string) {
    return this.registry.remove(code);
  }

  @Get(':code/memory')
  @RequirePermissions('api:agents:read')
  listMemory(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.memory.list(code, user.id);
  }

  @Post(':code/memory')
  @RequirePermissions('api:agents:chat')
  createMemory(
    @Param('code') code: string,
    @Body() dto: CreateMemoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.memory.create(code, user.id, dto);
  }

  @Delete('memory/:id')
  @RequirePermissions('api:agents:chat')
  deleteMemory(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.memory.remove(Number(id), user.id);
  }

  @Post('chat')
  @RequirePermissions('api:agents:chat')
  @RateLimit({ windowSeconds: 60, maxRequests: 30, keyPrefix: 'agents:chat' })
  chat(@Body() dto: AgentChatDto, @CurrentUser() user: AuthUser) {
    return this.runtime.chat({
      userId: user.id,
      message: dto.message,
      agentCode: dto.agentCode,
      conversationId: dto.conversationId,
      modelRef: dto.modelRef,
    });
  }
}
