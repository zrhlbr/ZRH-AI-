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
  ConnectMcpDto,
  DisconnectMcpDto,
  ListMcpLogsQueryDto,
  ListMcpQueryDto,
  UpdateMcpServerDto,
} from './dto/mcp.dto';
import { McpRegistryService } from './registry/mcp-registry.service';
import { McpGatewayService } from './gateway/mcp-gateway.service';
import { McpLogsService } from './logs/mcp-logs.service';
import { McpHealthService } from './health/mcp-health.service';

/**
 * /api/v1/mcp/* —— MCP Gateway & Registry（阶段 8）
 */
@Controller('mcp')
export class McpController {
  constructor(
    private readonly registry: McpRegistryService,
    private readonly gateway: McpGatewayService,
    private readonly logs: McpLogsService,
    private readonly health: McpHealthService,
  ) {}

  @Get('health')
  @RequirePermissions('api:mcp:read')
  healthCheck() {
    return this.health.status();
  }

  @Get('sessions')
  @RequirePermissions('api:mcp:read')
  sessions(@CurrentUser() user: AuthUser) {
    return this.gateway.listSessions(user.id);
  }

  @Get('logs')
  @RequirePermissions('api:mcp:admin')
  listLogs(@Query() q: ListMcpLogsQueryDto) {
    return this.logs.list({
      page: q.page,
      pageSize: q.pageSize,
      serverCode: q.serverCode,
    });
  }

  @Get('servers')
  @RequirePermissions('api:mcp:read')
  listServers(@Query() q: ListMcpQueryDto) {
    return this.registry.list({ enabled: q.enabled, status: q.status });
  }

  @Get('servers/:code')
  @RequirePermissions('api:mcp:read')
  getServer(@Param('code') code: string) {
    return this.registry.getByCode(code);
  }

  @Patch('servers/:code')
  @RequirePermissions('api:mcp:admin')
  updateServer(@Param('code') code: string, @Body() dto: UpdateMcpServerDto) {
    return this.registry.update(code, dto);
  }

  @Post('servers/:code/enable')
  @RequirePermissions('api:mcp:admin')
  enable(@Param('code') code: string) {
    return this.registry.setEnabled(code, true);
  }

  @Post('servers/:code/disable')
  @RequirePermissions('api:mcp:admin')
  disable(@Param('code') code: string) {
    return this.registry.setEnabled(code, false);
  }

  @Delete('servers/:code')
  @RequirePermissions('api:mcp:admin')
  remove(@Param('code') code: string) {
    return this.registry.remove(code);
  }

  @Post('connect')
  @RequirePermissions('api:mcp:write')
  @RateLimit({ windowSeconds: 60, maxRequests: 30, keyPrefix: 'mcp:connect' })
  connect(@Body() dto: ConnectMcpDto, @CurrentUser() user: AuthUser) {
    return this.gateway.connect({
      serverCode: dto.serverCode,
      userId: user.id,
      roleCode: user.role,
      metadata: dto.metadata,
    });
  }

  @Post('disconnect')
  @RequirePermissions('api:mcp:write')
  disconnect(@Body() dto: DisconnectMcpDto, @CurrentUser() user: AuthUser) {
    return this.gateway.disconnect({
      userId: user.id,
      sessionId: dto.sessionId,
      serverCode: dto.serverCode,
    });
  }

  @Post('invoke')
  @RequirePermissions('api:mcp:write')
  invoke(
    @Body() body: { serverCode: string; action: string; payload?: Record<string, unknown> },
  ) {
    return this.gateway.invokeStub(body.serverCode, body.action, body.payload);
  }
}
