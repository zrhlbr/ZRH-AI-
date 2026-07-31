import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpRegistryService } from './registry/mcp-registry.service';
import { McpGatewayService } from './gateway/mcp-gateway.service';
import { McpLogsService } from './logs/mcp-logs.service';
import { McpHealthService } from './health/mcp-health.service';

/**
 * Stage 8 MCP Gateway & Registry。
 * 第一批连接器为 reserved stub；框架与 API 先行。
 */
@Module({
  controllers: [McpController],
  providers: [McpRegistryService, McpGatewayService, McpLogsService, McpHealthService],
  exports: [McpRegistryService, McpGatewayService],
})
export class McpModule {}
