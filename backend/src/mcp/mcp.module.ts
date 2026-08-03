import { Module } from '@nestjs/common';
import { SystemModule } from '../system/system.module';
import { McpController } from './mcp.controller';
import { McpRegistryService } from './registry/mcp-registry.service';
import { McpGatewayService } from './gateway/mcp-gateway.service';
import { McpLogsService } from './logs/mcp-logs.service';
import { McpHealthService } from './health/mcp-health.service';

/**
 * MCP Gateway & Registry.
 * P2: filesystem/git via Dev Runner; docker/postgres/github mediated adapters.
 */
@Module({
  imports: [SystemModule],
  controllers: [McpController],
  providers: [McpRegistryService, McpGatewayService, McpLogsService, McpHealthService],
  exports: [McpRegistryService, McpGatewayService],
})
export class McpModule {}
