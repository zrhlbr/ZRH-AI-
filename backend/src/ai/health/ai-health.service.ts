import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IAIProvider } from '../interfaces/ai-provider.interface';
import { AIProviderHealth } from '../types/ai.types';

/**
 * AI Health Service：检查 Provider 与模型健康，并持久化到 model_health。
 */
@Injectable()
export class AIHealthService {
  private readonly logger = new Logger(AIHealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async checkProvider(provider: IAIProvider): Promise<AIProviderHealth> {
    const result = await provider.health();
    return result;
  }

  async checkModel(provider: IAIProvider, modelName: string) {
    const result = await provider.health(modelName);
    const model = await this.prisma.aIModel.findUnique({
      where: { providerCode_name: { providerCode: provider.code, name: modelName } },
    });
    if (model) {
      await this.prisma.modelHealth.create({
        data: {
          modelId: model.id,
          status: result.status,
          latencyMs: result.latencyMs ?? null,
          error: result.error ?? null,
        },
      });
      await this.prisma.aIModel.update({
        where: { id: model.id },
        data: { status: result.status },
      });
    }
    return { providerCode: provider.code, modelName, ...result };
  }

  async checkAll(providers: IAIProvider[], models?: { providerCode: string; name: string }[]) {
    const providerChecks = await Promise.all(
      providers.map(async (p) => {
        try {
          return { code: p.code, ...(await this.checkProvider(p)) };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`health check failed for ${p.code}: ${message}`);
          return { code: p.code, status: 'error', error: message, checkedAt: new Date() };
        }
      }),
    );

    const modelChecks = models
      ? await Promise.all(
          models.map(async (m) => {
            const provider = providers.find((p) => p.code === m.providerCode);
            if (!provider) return { providerCode: m.providerCode, modelName: m.name, status: 'error', error: 'provider not found', checkedAt: new Date() };
            try {
              return await this.checkModel(provider, m.name);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              return { providerCode: m.providerCode, modelName: m.name, status: 'error', error: message, checkedAt: new Date() };
            }
          }),
        )
      : [];

    return { providers: providerChecks, models: modelChecks };
  }
}
