import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OllamaEmbeddingProvider } from '../knowledge/embedding/ollama-embedding.provider';
import { RunnerClientService } from './runner-client.service';
import { WorkspaceService } from './workspace.service';
import { SecurityPolicyService } from './security-policy.service';

const SYMBOL_RE =
  /\b(export\s+)?(async\s+)?(function|class|const|let|var|interface|type|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/g;

function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

@Injectable()
export class CodeIndexService {
  private readonly logger = new Logger(CodeIndexService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: RunnerClientService,
    private readonly workspaces: WorkspaceService,
    private readonly policy: SecurityPolicyService,
    private readonly embedding: OllamaEmbeddingProvider,
  ) {}

  async rebuild(workspaceId: number, userId: number, roleCode: string) {
    await this.workspaces.assertAccess(workspaceId, userId, roleCode, 'editor');
    const { items } = await this.runner.tree(workspaceId);
    const files = items.filter((i) => i.type === 'file' && !this.policy.isEnvPath(i.path));
    await this.prisma.devCodeSymbol.deleteMany({ where: { workspaceId } });
    await this.prisma.devCodeVector.deleteMany({ where: { workspaceId } });
    await this.prisma.devCodeFile.deleteMany({ where: { workspaceId } });

    let indexed = 0;
    let embedded = 0;
    for (const f of files.slice(0, 500)) {
      try {
        const file = await this.runner.readFile(workspaceId, f.path);
        const hash = createHash('sha256').update(file.content).digest('hex');
        const lang = f.path.split('.').pop() || 'txt';
        await this.prisma.devCodeFile.create({
          data: {
            workspaceId,
            path: f.path,
            hash,
            language: lang,
            sizeBytes: file.size,
            mtimeMs: BigInt(Date.now()),
          },
        });
        const symbols: Array<{ name: string; kind: string; lineStart: number }> = [];
        const lines = file.content.split('\n');
        lines.forEach((line, idx) => {
          SYMBOL_RE.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = SYMBOL_RE.exec(line))) {
            symbols.push({ name: m[4], kind: m[3], lineStart: idx + 1 });
          }
        });
        if (symbols.length) {
          await this.prisma.devCodeSymbol.createMany({
            data: symbols.slice(0, 200).map((s) => ({
              workspaceId,
              name: s.name,
              kind: s.kind,
              path: f.path,
              lineStart: s.lineStart,
              lineEnd: s.lineStart,
            })),
          });
        }
        const chunkSize = 1200;
        for (let i = 0, chunkIndex = 0; i < file.content.length && chunkIndex < 8; i += chunkSize, chunkIndex++) {
          const content = this.policy.redact(file.content.slice(i, i + chunkSize));
          let embeddingJson: Prisma.InputJsonValue | undefined;
          try {
            const vec = await this.embedding.embed(content.slice(0, 2000));
            embeddingJson = vec as unknown as Prisma.InputJsonValue;
            embedded += 1;
          } catch (err) {
            this.logger.warn(
              `embed skip ${f.path}#${chunkIndex}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
          await this.prisma.devCodeVector.create({
            data: {
              workspaceId,
              path: f.path,
              chunkIndex,
              content,
              ...(embeddingJson ? { embedding: embeddingJson } : {}),
            },
          });
        }
        indexed += 1;
      } catch {
        // skip unreadable
      }
    }
    await this.prisma.devWorkspace.update({
      where: { id: workspaceId },
      data: { status: 'active' },
    });
    return { indexed, files: files.length, embedded };
  }

  async searchFiles(workspaceId: number, userId: number, roleCode: string, query: string) {
    await this.workspaces.assertAccess(workspaceId, userId, roleCode, 'viewer');
    return this.runner.searchFiles(workspaceId, query);
  }

  async searchSymbols(workspaceId: number, userId: number, roleCode: string, query: string) {
    await this.workspaces.assertAccess(workspaceId, userId, roleCode, 'viewer');
    const items = await this.prisma.devCodeSymbol.findMany({
      where: {
        workspaceId,
        name: { contains: query, mode: 'insensitive' },
      },
      take: 100,
      orderBy: { name: 'asc' },
    });
    return { items };
  }

  async searchRefs(workspaceId: number, userId: number, roleCode: string, query: string) {
    await this.workspaces.assertAccess(workspaceId, userId, roleCode, 'viewer');
    return this.runner.searchContent(workspaceId, query);
  }

  async searchSemantic(workspaceId: number, userId: number, roleCode: string, query: string) {
    await this.workspaces.assertAccess(workspaceId, userId, roleCode, 'viewer');
    const rows = await this.prisma.devCodeVector.findMany({
      where: { workspaceId },
      take: 800,
      orderBy: { id: 'asc' },
    });

    try {
      const qVec = await this.embedding.embed(query.slice(0, 2000));
      const scored = rows
        .map((r) => {
          const emb = Array.isArray(r.embedding) ? (r.embedding as number[]) : null;
          const score = emb ? cosine(qVec, emb) : 0;
          return { id: r.id, path: r.path, chunkIndex: r.chunkIndex, content: r.content, score };
        })
        .filter((r) => r.score > 0.15)
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
      if (scored.length) {
        return { items: scored, mode: 'embedding' };
      }
    } catch (err) {
      this.logger.warn(`semantic embed query failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const q = query.toLowerCase();
    const scored = rows
      .map((r) => {
        const text = r.content.toLowerCase();
        let score = 0;
        for (const token of q.split(/\s+/).filter(Boolean)) {
          if (text.includes(token)) score += 1;
        }
        return {
          id: r.id,
          path: r.path,
          chunkIndex: r.chunkIndex,
          content: r.content,
          score,
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    return { items: scored, mode: 'lexical-fallback' };
  }
}
