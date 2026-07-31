import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RagAskDto, RagSearchDto } from './dto/rag.dto';
import { RagEngineService } from './engine/rag-engine.service';
import { RagHealthService } from './health/rag-health.service';
import { QueryRewriteService } from './rewrite/query-rewrite.service';

/**
 * /api/v1/rag/* —— Enterprise RAG Engine（阶段 6）
 */
@Controller('rag')
export class RagController {
  constructor(
    private readonly engine: RagEngineService,
    private readonly health: RagHealthService,
    private readonly rewrite: QueryRewriteService,
  ) {}

  @Get('health')
  @RequirePermissions('api:rag:read')
  healthCheck() {
    return this.health.status();
  }

  @Get('rewrite')
  @RequirePermissions('api:rag:read')
  rewriteQuery(@Query('q') q: string, @Query('lang') lang?: string) {
    return this.rewrite.rewrite(q ?? '', lang);
  }

  @Get('search')
  @RequirePermissions('api:rag:read')
  @RateLimit({ windowSeconds: 60, maxRequests: 30, keyPrefix: 'rag:search' })
  search(@Query() q: RagSearchDto, @CurrentUser() user: AuthUser) {
    return this.engine.search({
      userId: user.id,
      query: q.query,
      mode: q.mode,
      topK: q.topK,
      minScore: q.minScore,
    });
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
      topK: dto.topK,
    });
  }
}
