import { Injectable } from '@nestjs/common';
import { ModelRegistryService } from '../registry/model-registry.service';
import { AIRouterDecision, AIModelDescriptor } from '../types/ai.types';

/**
 * Model Router：根据 Prompt 内容自动选择最合适的 Provider + 模型。
 * 阶段 4 支持 Manual（指定模型优先）与 Keyword Auto（关键词自动）。
 */
@Injectable()
export class ModelRouterService {
  constructor(private readonly registry: ModelRegistryService) {}

  /**
   * 路由决策。
   * @param prompt 用户输入（或完整上下文）
   * @param preferredModel 用户/会话指定的模型，如 ollama:qwen3:8b
   */
  async route(prompt: string, preferredModel?: string): Promise<AIRouterDecision> {
    if (preferredModel) {
      const parsed = this.parseModelRef(preferredModel);
      const model = await this.registry.findModel(parsed.providerCode, parsed.name);
      if (model && model.enabled) {
        return {
          providerCode: parsed.providerCode,
          modelName: parsed.name,
          reason: `manual: ${preferredModel}`,
        };
      }
    }

    const auto = await this.keywordRoute(prompt);
    if (auto) return auto;

    const def = await this.registry.getDefaultModel();
    if (def) {
      return { providerCode: def.providerCode, modelName: def.name, reason: 'fallback to default' };
    }

    return { providerCode: 'ollama', modelName: 'qwen3:8b', reason: 'hardcoded fallback' };
  }

  /** 简单关键词路由策略（阶段 4 初版） */
  private async keywordRoute(prompt: string): Promise<AIRouterDecision | null> {
    const text = prompt.toLowerCase();
    const models = await this.registry.listModels([]).catch(() => [] as AIModelDescriptor[]);

    const has = (cap: string) => models.filter((m) => m.capabilities?.includes(cap) && m.enabled);

    // 代码相关 → deepseek-coder
    if (/code|program|function|class|bug|debug|python|javascript|typescript|java|c\+\+|rust|go|sql/.test(text)) {
      const coder = models.find((m) => /coder|code/i.test(m.name) && m.enabled);
      if (coder) return { providerCode: coder.providerCode, modelName: coder.name, reason: 'auto: code task' };
      const fallback = has('code')[0];
      if (fallback) return { providerCode: fallback.providerCode, modelName: fallback.name, reason: 'auto: code capability' };
    }

    // 推理 / 数学 → deepseek-r1
    if (/reason|logic|math|prove|calculate|solve|think|step by step/.test(text)) {
      const reasoner = models.find((m) => /r1|reason/i.test(m.name) && m.enabled);
      if (reasoner) return { providerCode: reasoner.providerCode, modelName: reasoner.name, reason: 'auto: reasoning task' };
      const fallback = has('reasoning')[0];
      if (fallback) return { providerCode: fallback.providerCode, modelName: fallback.name, reason: 'auto: reasoning capability' };
    }

    // 中文/缅文多语言 → qwen
    if (/[\u4e00-\u9fff]|[^\x00-\x7f]/.test(text)) {
      const qwen = models.find((m) => /qwen/i.test(m.name) && m.enabled);
      if (qwen) return { providerCode: qwen.providerCode, modelName: qwen.name, reason: 'auto: multilingual task' };
      const fallback = has('multilingual')[0];
      if (fallback) return { providerCode: fallback.providerCode, modelName: fallback.name, reason: 'auto: multilingual capability' };
    }

    return null;
  }

  private parseModelRef(ref: string): { providerCode: string; name: string } {
    const parts = ref.split(':');
    if (parts.length >= 3) {
      return { providerCode: parts[0], name: parts.slice(1).join(':') };
    }
    if (parts.length === 2) {
      return { providerCode: parts[0], name: parts[1] };
    }
    return { providerCode: 'ollama', name: ref };
  }
}
