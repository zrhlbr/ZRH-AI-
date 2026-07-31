import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IAIProvider } from '../interfaces/ai-provider.interface';
import { AIModelDescriptor } from '../types/ai.types';

/**
 * Model Registry：统一维护 Provider 与模型元数据。
 * - 数据库为权威来源
 * - 运行时与 Provider 真实清单合并状态
 */
@Injectable()
export class ModelRegistryService {
  private readonly logger = new Logger(ModelRegistryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 按 providerCode 查找数据库中的 Provider */
  async findProvider(code: string) {
    return this.prisma.aIProvider.findUnique({ where: { code } });
  }

  /** 按 providerCode + name 查找模型 */
  async findModel(providerCode: string, name: string) {
    return this.prisma.aIModel.findUnique({
      where: { providerCode_name: { providerCode, name } },
      include: { capabilities: { include: { capability: true } } },
    });
  }

  /** 列出所有启用模型，并与 Provider 真实清单合并状态 */
  async listModels(providers: IAIProvider[]): Promise<AIModelDescriptor[]> {
    const dbModels = await this.prisma.aIModel.findMany({
      where: { enabled: true },
      include: {
        provider: true,
        capabilities: { include: { capability: true } },
      },
      orderBy: [{ provider: { sortOrder: 'asc' } }, { name: 'asc' }],
    });

    const remoteLists = await Promise.all(
      providers.map(async (p) => {
        try {
          return { code: p.code, models: await p.listModels() };
        } catch (error) {
          this.logger.warn(`listModels failed for ${p.code}: ${error instanceof Error ? error.message : error}`);
          return { code: p.code, models: [] as AIModelDescriptor[] };
        }
      }),
    );
    const remoteMap = new Map<string, AIModelDescriptor>();
    for (const list of remoteLists) {
      for (const m of list.models) {
        remoteMap.set(`${list.code}:${m.name}`, m);
      }
    }

    return dbModels.map((m) => {
      const remote = remoteMap.get(`${m.providerCode}:${m.name}`);
      return {
        name: m.name,
        displayName: m.displayName,
        providerCode: m.providerCode,
        description: m.description ?? undefined,
        sizeBytes: remote?.sizeBytes ?? (Number(m.sizeBytes ?? 0) || null),
        digest: remote?.digest ?? m.digest ?? null,
        status: remote ? 'online' : m.status,
        enabled: m.enabled,
        isDefault: m.isDefault,
        contextLength: m.contextLength,
        capabilities: m.capabilities.map((c) => c.capability.code),
      };
    });
  }

  /** 获取默认模型，未设置则取第一个启用模型 */
  async getDefaultModel(): Promise<AIModelDescriptor | null> {
    const model = await this.prisma.aIModel.findFirst({
      where: { enabled: true, isDefault: true },
      include: { capabilities: { include: { capability: true } } },
    });
    if (model) return this.toDescriptor(model);
    const fallback = await this.prisma.aIModel.findFirst({
      where: { enabled: true },
      orderBy: { createdAt: 'asc' },
      include: { capabilities: { include: { capability: true } } },
    });
    return fallback ? this.toDescriptor(fallback) : null;
  }

  /** 设置默认模型（仅一个为 true） */
  async setDefaultModel(providerCode: string, name: string) {
    await this.prisma.$transaction([
      this.prisma.aIModel.updateMany({ data: { isDefault: false } }),
      this.prisma.aIModel.updateMany({
        where: { providerCode, name },
        data: { isDefault: true },
      }),
    ]);
    return { providerCode, name, isDefault: true };
  }

  /** 启用 / 禁用模型 */
  async setModelEnabled(providerCode: string, name: string, enabled: boolean) {
    return this.prisma.aIModel.updateMany({
      where: { providerCode, name },
      data: { enabled },
    });
  }

  /** 同步 Provider 返回的模型清单到 Registry */
  async syncFromProvider(provider: IAIProvider) {
    const remote = await provider.listModels();
    for (const m of remote) {
      await this.prisma.aIModel.upsert({
        where: { providerCode_name: { providerCode: provider.code, name: m.name } },
        create: {
          providerCode: provider.code,
          name: m.name,
          displayName: m.displayName || m.name,
          sizeBytes: m.sizeBytes ? BigInt(m.sizeBytes) : null,
          digest: m.digest ?? null,
          status: m.status || 'online',
          enabled: true,
          isDefault: false,
          contextLength: m.contextLength || 8192,
        },
        update: {
          displayName: m.displayName || m.name,
          sizeBytes: m.sizeBytes ? BigInt(m.sizeBytes) : undefined,
          digest: m.digest ?? undefined,
          status: m.status || 'online',
        },
      });
    }
    return { synced: remote.length };
  }

  private toDescriptor(model: { providerCode: string; name: string; displayName: string; description?: string | null; sizeBytes?: bigint | null; digest?: string | null; status: string; enabled: boolean; isDefault: boolean; contextLength: number; capabilities: { capability: { code: string } }[] }): AIModelDescriptor {
    return {
      name: model.name,
      displayName: model.displayName,
      providerCode: model.providerCode,
      description: model.description ?? undefined,
      sizeBytes: model.sizeBytes ? Number(model.sizeBytes) : null,
      digest: model.digest ?? null,
      status: model.status,
      enabled: model.enabled,
      isDefault: model.isDefault,
      contextLength: model.contextLength,
      capabilities: model.capabilities.map((c) => c.capability.code),
    };
  }
}
