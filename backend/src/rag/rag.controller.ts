import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RagAskDto } from './dto/rag.dto';
import { RagEngineService } from './engine/rag-engine.service';

/**
 * /api/v1/rag/* —— Enterprise RAG Engine（阶段 6）
 */
@Controller('rag')
export class RagController {
  constructor(private readonly engine: RagEngineService) {}

  @Get('ping')
  @RequirePermissions('api:rag:read')
  ping() {
    return { service: 'zrh-ai-rag', stage: 6, status: 'scaffolded' };
  }

  @Post('ask')
  @RequirePermissions('api:rag:write')
  @RateLimit({ windowSeconds: 60, maxRequests: 20, keyPrefix: 'rag:ask' })
  ask(@Body() dto: RagAskDto, @CurrentUser() user: AuthUser) {
    return this.engine.ask({
      userId: user.id,
      query: dto.query,
      conversationId: dto.conversationId,
      mode: dto.mode,
      modelRef: dto.modelRef,
    });
  }
}
