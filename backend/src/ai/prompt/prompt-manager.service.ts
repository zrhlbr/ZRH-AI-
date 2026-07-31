import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Prompt Manager：统一解析 System Prompt。
 * 优先级：会话自定义 > 指定模板 code > 默认模板。
 */
@Injectable()
export class PromptManagerService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveSystemPrompt(custom: string | null | undefined, promptCode?: string | null): Promise<string | null> {
    if (custom) return custom;
    if (promptCode) {
      const tpl = await this.prisma.promptTemplate.findUnique({ where: { code: promptCode } });
      if (tpl) return tpl.content;
    }
    const def = await this.prisma.promptTemplate.findFirst({
      where: { role: 'system', isDefault: true },
    });
    return def?.content ?? null;
  }

  async listPrompts() {
    return this.prisma.promptTemplate.findMany({
      orderBy: [{ role: 'asc' }, { id: 'asc' }],
    });
  }
}
