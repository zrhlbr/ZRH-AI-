import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { OllamaModule } from './ollama/ollama.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { SystemModule } from './system/system.module';
import { ChatModule } from './chat/chat.module';
import { AIModule } from './ai/ai.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { RagModule } from './rag/rag.module';
import { AgentsModule } from './agents/agents.module';
import { ToolsModule } from './tools/tools.module';
import { McpModule } from './mcp/mcp.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { BusinessModule } from './business/business.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [PrismaModule, RedisModule, OllamaModule, HealthModule, AuthModule, SystemModule, ChatModule, AIModule, KnowledgeModule, RagModule, AgentsModule, ToolsModule, McpModule, WorkflowsModule, BusinessModule],
  providers: [
    // 全局鉴权：JWT → 权限码（@Public() 除外）→ 限流
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    // 统一响应 / 统一日志 / 统一异常
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
