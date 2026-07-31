import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AIGatewayService } from '../../ai/gateway/ai-gateway.service';
import { RetrieverService } from '../../knowledge/retriever/retriever.service';
import { ParserService } from '../../knowledge/parser/parser.service';
import { StorageService } from '../../knowledge/storage/storage.service';
import { RagEngineService } from '../../rag/engine/rag-engine.service';
import * as path from 'path';
import { promises as fs } from 'fs';

type ExecCtx = {
  userId: number;
  args: Record<string, unknown>;
};

/**
 * 内置 Tool 执行器（Stage 8 第一批 10 个）。
 * 全部经 Tool Runtime 调用；禁止业务侧绕过。
 */
@Injectable()
export class BuiltinExecutorsService {
  private readonly logger = new Logger(BuiltinExecutorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AIGatewayService,
    private readonly retriever: RetrieverService,
    private readonly parser: ParserService,
    private readonly storage: StorageService,
    private readonly rag: RagEngineService,
  ) {}

  async execute(executorCode: string, ctx: ExecCtx): Promise<unknown> {
    switch (executorCode) {
      case 'knowledge_search':
        return this.knowledgeSearch(ctx);
      case 'rag_search':
        return this.ragSearch(ctx);
      case 'document_parser':
        return this.documentParser(ctx);
      case 'translation':
        return this.translation(ctx);
      case 'code_execute':
        return this.codeExecute(ctx);
      case 'file_manager':
        return this.fileManager(ctx);
      case 'http_request':
        return this.httpRequest(ctx);
      case 'database_query':
        return this.databaseQuery(ctx);
      case 'system_health':
        return this.systemHealth(ctx);
      case 'calculator':
        return this.calculator(ctx);
      default:
        throw new BadRequestException(`unknown executor: ${executorCode}`);
    }
  }

  private str(args: Record<string, unknown>, key: string, required = true): string {
    const v = args[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (!required) return '';
    throw new BadRequestException(`missing/invalid arg: ${key}`);
  }

  private num(args: Record<string, unknown>, key: string, fallback: number): number {
    const v = args[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
    return fallback;
  }

  /** 安全计算器：仅允许数字与 + - * / ( ) . 空格 */
  private evalSafeExpression(expression: string): number {
    const expr = expression.replace(/\s+/g, '');
    if (!expr || expr.length > 200) {
      throw new BadRequestException('expression too long or empty');
    }
    if (!/^[0-9+\-*/().]+$/.test(expr)) {
      throw new BadRequestException('expression contains unsafe characters');
    }
    // 禁止连续运算符等极端情况：用 Function 仍受限字符集
    // eslint-disable-next-line no-new-func
    const fn = new Function(`"use strict"; return (${expr});`);
    const result = fn();
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      throw new BadRequestException('expression did not evaluate to a finite number');
    }
    return result;
  }

  private async knowledgeSearch(ctx: ExecCtx) {
    const query = this.str(ctx.args, 'query');
    const topK = Math.min(20, Math.max(1, this.num(ctx.args, 'topK', 5)));
    const mode = (this.str(ctx.args, 'mode', false) || 'hybrid') as 'keyword' | 'semantic' | 'hybrid';
    return this.retriever.search({
      query,
      mode,
      topK,
      userId: ctx.userId,
    });
  }

  private async ragSearch(ctx: ExecCtx) {
    const query = this.str(ctx.args, 'query');
    const mode = (this.str(ctx.args, 'mode', false) || 'hybrid') as 'keyword' | 'semantic' | 'hybrid';
    const topK = Math.min(50, Math.max(5, this.num(ctx.args, 'topK', 20)));
    return this.rag.search({
      userId: ctx.userId,
      query,
      mode,
      topK,
    });
  }

  private async documentParser(ctx: ExecCtx) {
    const content = this.str(ctx.args, 'content');
    const filename = this.str(ctx.args, 'filename', false) || 'inline.txt';
    const lower = filename.toLowerCase();
    const mime = lower.endsWith('.md')
      ? 'text/markdown'
      : lower.endsWith('.html') || lower.endsWith('.htm')
        ? 'text/html'
        : lower.endsWith('.json')
          ? 'application/json'
          : 'text/plain';
    const parsed = await this.parser.parse(Buffer.from(content, 'utf8'), mime, filename);
    return {
      title: parsed.title,
      filename,
      mimeType: mime,
      textPreview: (parsed.content ?? '').slice(0, 2000),
      charCount: (parsed.content ?? '').length,
      pages: parsed.pages ?? null,
      language: parsed.language ?? null,
    };
  }

  private async translation(ctx: ExecCtx) {
    const text = this.str(ctx.args, 'text');
    const targetLang = this.str(ctx.args, 'targetLang').toLowerCase();
    const langMap: Record<string, string> = {
      zh: 'Chinese',
      'zh-cn': 'Chinese',
      en: 'English',
      'en-us': 'English',
      my: 'Burmese',
      'my-mm': 'Burmese',
      burmese: 'Burmese',
      chinese: 'Chinese',
      english: 'English',
    };
    const target = langMap[targetLang] ?? targetLang;
    const prompt = [
      {
        role: 'system' as const,
        content:
          'You are a professional translator. Translate the user text accurately. Output only the translation, no explanations.',
      },
      {
        role: 'user' as const,
        content: `Translate to ${target}:\n\n${text.slice(0, 8000)}`,
      },
    ];
    const translated = await this.gateway.generate(prompt);
    return { sourceText: text, targetLang: target, translated };
  }

  private async codeExecute(ctx: ExecCtx) {
    const expression = this.str(ctx.args, 'expression');
    const result = this.evalSafeExpression(expression);
    return {
      sandbox: 'expression-only',
      expression,
      result,
      note: 'Only arithmetic expressions are allowed; no I/O, no imports.',
    };
  }

  private async fileManager(ctx: ExecCtx) {
    const action = this.str(ctx.args, 'action', false) || 'list';
    const rel = this.str(ctx.args, 'path', false) || '';
    if (rel.includes('..') || path.isAbsolute(rel)) {
      throw new BadRequestException('path traversal not allowed');
    }
    const baseDir =
      process.env.KNOWLEDGE_STORAGE_PATH ??
      path.join(process.cwd(), 'storage', 'documents');

    if (action === 'list') {
      const target = path.join(baseDir, rel);
      try {
        const entries = await fs.readdir(target, { withFileTypes: true });
        return {
          action,
          path: rel || '.',
          entries: entries.slice(0, 100).map((e) => ({
            name: e.name,
            type: e.isDirectory() ? 'dir' : 'file',
          })),
        };
      } catch {
        return { action, path: rel || '.', entries: [], note: 'directory empty or unavailable' };
      }
    }

    if (action === 'exists') {
      const ok = await this.storage.exists(rel);
      return { action, path: rel, exists: ok };
    }

    if (action === 'readMeta') {
      const ok = await this.storage.exists(rel);
      if (!ok) return { action, path: rel, exists: false };
      const full = path.join(baseDir, rel);
      const stat = await fs.stat(full);
      return {
        action,
        path: rel,
        exists: true,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      };
    }

    throw new BadRequestException('unsupported file_manager action');
  }

  private async httpRequest(ctx: ExecCtx) {
    const url = this.str(ctx.args, 'url');
    const method = (this.str(ctx.args, 'method', false) || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      throw new BadRequestException('only GET/HEAD allowed');
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('invalid url');
    }
    const host = parsed.hostname.toLowerCase();
    const allow = new Set([
      '127.0.0.1',
      'localhost',
      'host.docker.internal',
      'ollama',
      'zrh-ai-api',
    ]);
    if (!allow.has(host)) {
      throw new BadRequestException(`host not in allowlist: ${host}`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('unsupported protocol');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, { method, signal: controller.signal });
      const text = await res.text();
      return {
        status: res.status,
        ok: res.ok,
        contentType: res.headers.get('content-type'),
        bodyPreview: text.slice(0, 2000),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async databaseQuery(ctx: ExecCtx) {
    const metric = this.str(ctx.args, 'metric', false) || 'overview';
    if (metric === 'overview' || metric === 'counts') {
      const [users, documents, agents, tools, mcp] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.knowledgeDocument.count().catch(() => 0),
        this.prisma.agent.count(),
        this.prisma.toolDefinition.count(),
        this.prisma.mcpServer.count(),
      ]);
      return {
        readOnly: true,
        metric: 'overview',
        counts: { users, documents, agents, tools, mcpServers: mcp },
      };
    }
    if (metric === 'tools') {
      const byEnabled = await this.prisma.toolDefinition.groupBy({
        by: ['enabled'],
        _count: true,
      });
      return { readOnly: true, metric: 'tools', byEnabled };
    }
    throw new BadRequestException('unsupported metric; use overview|tools');
  }

  private async systemHealth(_ctx: ExecCtx) {
    const [toolsTotal, toolsEnabled, mcpTotal, mcpEnabled, errors24h] = await Promise.all([
      this.prisma.toolDefinition.count(),
      this.prisma.toolDefinition.count({ where: { enabled: true } }),
      this.prisma.mcpServer.count(),
      this.prisma.mcpServer.count({ where: { enabled: true } }),
      this.prisma.toolRunLog.count({
        where: {
          status: { in: ['error', 'timeout'] },
          createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
        },
      }),
    ]);
    return {
      ok: toolsEnabled > 0,
      tools: { total: toolsTotal, enabled: toolsEnabled },
      mcp: { total: mcpTotal, enabled: mcpEnabled },
      toolErrors24h: errors24h,
      timestamp: new Date().toISOString(),
    };
  }

  private async calculator(ctx: ExecCtx) {
    const expression = this.str(ctx.args, 'expression');
    const result = this.evalSafeExpression(expression);
    return { expression, result };
  }
}
