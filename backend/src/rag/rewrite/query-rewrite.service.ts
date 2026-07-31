import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface RewriteResult {
  original: string;
  rewritten: string;
  expansions: string[];
  language: string;
}

/**
 * Query Rewrite：同义词 / 缩写 / 业务词 / 多语言扩展。
 */
@Injectable()
export class QueryRewriteService {
  constructor(private readonly prisma: PrismaService) {}

  detectLanguage(text: string): string {
    if (/[\u1000-\u109F]/.test(text)) return 'my-MM';
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
    return 'en-US';
  }

  private tokenize(text: string): string[] {
    return text
      .split(/[\s,，。；;、/\\|()\[\]{}]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  async rewrite(query: string, preferredLanguage?: string): Promise<RewriteResult> {
    const original = (query ?? '').trim();
    if (!original) {
      return { original: '', rewritten: '', expansions: [], language: preferredLanguage ?? 'zh-CN' };
    }
    const language = preferredLanguage || this.detectLanguage(original);
    const rows = await this.prisma.ragSynonym.findMany({
      where: {
        enabled: true,
        OR: [{ language }, { language: '*' }],
      },
    });

    const expansions = new Set<string>();
    let rewritten = original;
    const lower = original.toLowerCase();

    for (const row of rows) {
      let synonyms: string[] = [];
      try {
        synonyms = JSON.parse(row.synonyms) as string[];
      } catch {
        synonyms = row.synonyms.split(',').map((s) => s.trim()).filter(Boolean);
      }
      const term = row.term;
      const hit =
        lower.includes(term.toLowerCase()) ||
        this.tokenize(original).some((t) => t.toLowerCase() === term.toLowerCase());
      if (!hit) continue;
      for (const s of synonyms) {
        if (!s || s.toLowerCase() === term.toLowerCase()) continue;
        expansions.add(s);
      }
    }

    if (expansions.size > 0) {
      rewritten = `${original} ${[...expansions].join(' ')}`.replace(/\s+/g, ' ').trim();
    }

    return {
      original,
      rewritten,
      expansions: [...expansions],
      language,
    };
  }
}
