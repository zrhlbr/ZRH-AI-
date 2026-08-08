import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIGatewayService } from './gateway/ai-gateway.service';
import { ModelRegistryService } from './registry/model-registry.service';
import { ModelRouterService } from './router/model-router.service';
import { StreamingManagerService } from './stream/streaming-manager.service';
import { PromptManagerService } from './prompt/prompt-manager.service';
import { AIHealthService } from './health/ai-health.service';
import { HybridInferenceRouter } from './hybrid/hybrid-inference.router';

/**
 * AI Gateway 模块（阶段 4）。
 * 统一接入所有 AI Provider，禁止业务模块直接调用 Ollama。
 */
@Module({
  controllers: [AIController],
  providers: [
    HybridInferenceRouter,
    AIGatewayService,
    ModelRegistryService,
    ModelRouterService,
    StreamingManagerService,
    PromptManagerService,
    AIHealthService,
  ],
  exports: [AIGatewayService, HybridInferenceRouter],
})
export class AIModule {}
