import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AIGatewayService } from './gateway/ai-gateway.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/guards/jwt-auth.guard';
import {
  ProviderCodeDto,
  ModelRefDto,
  SetDefaultModelDto,
  SetModelEnabledDto,
  RouteDecisionQueryDto,
  StreamChatDto,
  StopStreamDto,
} from './dto/ai.dto';

/**
 * /api/v1/ai/* —— AI Gateway 统一入口（阶段 4）
 */
@Controller('ai')
export class AIController {
  constructor(private readonly gateway: AIGatewayService) {}

  // ---------- Provider / Registry ----------

  @Get('providers')
  @RequirePermissions('api:ai:read')
  providers() {
    return {
      providers: this.gateway.getProviders().map((p) => ({
        code: p.code,
        enabled: p.isEnabled(),
        supportsPull: typeof p.pullModel === 'function',
        supportsDelete: typeof p.deleteModel === 'function',
        supportsEmbeddings: typeof p.embeddings === 'function',
        supportsToolCall: typeof p.toolCall === 'function',
      })),
    };
  }

  @Get('providers/:providerCode/health')
  @RequirePermissions('api:ai:read')
  providerHealth(@Param() param: ProviderCodeDto) {
    return this.gateway.checkProvider(param.providerCode);
  }

  @Post('providers/:providerCode/sync')
  @RequirePermissions('api:ai:admin')
  @RateLimit({ windowSeconds: 60, maxRequests: 10, keyPrefix: 'ai:sync' })
  syncProvider(@Param() param: ProviderCodeDto) {
    return this.gateway.syncProvider(param.providerCode);
  }

  @Get('models')
  @RequirePermissions('api:ai:read')
  models() {
    return this.gateway.listModels();
  }

  @Get('models/default')
  @RequirePermissions('api:ai:read')
  async defaultModel() {
    const model = await this.gateway.getDefaultModel();
    return { model };
  }

  @Post('models/default')
  @RequirePermissions('api:ai:admin')
  setDefault(@Body() dto: SetDefaultModelDto) {
    return this.gateway.setDefaultModel(dto.providerCode, dto.name);
  }

  @Post('models/enabled')
  @RequirePermissions('api:ai:admin')
  setEnabled(@Body() dto: SetModelEnabledDto) {
    return this.gateway.setModelEnabled(dto.providerCode, dto.name, dto.enabled);
  }

  @Get('models/:providerCode/:name/health')
  @RequirePermissions('api:ai:read')
  modelHealth(@Param() param: ModelRefDto) {
    return this.gateway.checkModel(param.providerCode, param.name);
  }

  @Post('models/:providerCode/:name/pull')
  @RequirePermissions('api:ai:admin')
  @RateLimit({ windowSeconds: 3600, maxRequests: 5, keyPrefix: 'ai:pull' })
  async pullModel(@Param() param: ModelRefDto, @Res() res: Response) {
    const stream = this.gateway.pullModel(param.providerCode, param.name);
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.flushHeaders();
    stream.subscribe({
      next: (chunk) => res.write(`data: ${JSON.stringify(chunk)}\n\n`),
      error: (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        res.write(`data: ${JSON.stringify({ status: 'error', error: message })}\n\n`);
        res.end();
      },
      complete: () => res.end(),
    });
  }

  @Delete('models/:providerCode/:name')
  @RequirePermissions('api:ai:admin')
  @RateLimit({ windowSeconds: 3600, maxRequests: 5, keyPrefix: 'ai:delete' })
  async deleteModel(@Param() param: ModelRefDto) {
    const ok = await this.gateway.deleteModel(param.providerCode, param.name);
    return { deleted: ok };
  }

  @Get('models/:providerCode/:name/show')
  @RequirePermissions('api:ai:read')
  showModel(@Param() param: ModelRefDto) {
    return this.gateway.showModel(param.providerCode, param.name);
  }

  // ---------- Router ----------

  @Get('router/decision')
  @RequirePermissions('api:ai:read')
  async routeDecision(@Query() q: RouteDecisionQueryDto) {
    return this.gateway.route(q.prompt, q.modelRef);
  }

  // ---------- Health ----------

  @Get('health')
  @RequirePermissions('api:ai:read')
  async health() {
    return this.gateway.checkAll();
  }

  // ---------- Chat via Gateway ----------

  @Post('chat')
  @RequirePermissions('api:ai:write')
  @RateLimit({ windowSeconds: 60, maxRequests: 20, keyPrefix: 'ai:chat' })
  async chat(
    @Body() dto: StreamChatDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!dto.message?.trim()) throw new BadRequestException('message is required');
    const messages = [
      ...(dto.systemPrompt ? [{ role: 'system' as const, content: dto.systemPrompt }] : []),
      { role: 'user' as const, content: dto.message.trim() },
    ];
    const { stream } = await this.gateway.stream(messages, {
      conversationId: dto.conversationId,
      modelRef: dto.modelRef,
      temperature: dto.temperature,
      topP: dto.topP,
      topK: dto.topK,
      repeatPenalty: dto.repeatPenalty,
      contextLength: dto.contextLength,
      maxTokens: dto.maxTokens,
      seed: dto.seed,
    });
    req.on('close', () => {
      if (dto.conversationId !== undefined) {
        this.gateway.stop(dto.conversationId);
        this.gateway.releaseStream(dto.conversationId);
      }
    });
    return this.gateway.streamToResponse(stream, res);
  }

  @Post('chat/stop')
  @RequirePermissions('api:ai:write')
  stop(@Body() dto: StopStreamDto) {
    return { stopped: this.gateway.stop(dto.conversationId) };
  }
}
