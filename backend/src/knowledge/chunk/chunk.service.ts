import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { ChunkMetadata } from '../types/knowledge.types';

export interface ChunkCandidate {
  chunkIndex: number;
  page?: number;
  position?: number;
  language?: string;
  tokenCount: number;
  content: string;
  metadata?: ChunkMetadata;
}

export interface ChunkOptions {
  strategy?: 'fixed' | 'heading' | 'auto';
  size?: number;
  overlap?: number;
  /** 防止超大文档产生过多 chunk（默认 2000） */
  maxChunks?: number;
  mimeType?: string;
  filename?: string;
}

/**
 * Chunk Service：统一文本分块。
 * 支持固定长度切分与标题感知切分（预留语义切分接口）。
 */
@Injectable()
export class ChunkService {
  private readonly defaultSize = 800;
  private readonly defaultOverlap = 80;
  private readonly defaultMaxChunks = 2000;

  /** 简单 token 估算：1 token ≈ 4 字符（中英缅混合） */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /** 根据 MIME / 扩展名推荐策略（不改变调用方也可显式指定） */
  recommendStrategy(mimeType?: string, filename?: string, text?: string): 'fixed' | 'heading' {
    const ext = (filename ?? '').split('.').pop()?.toLowerCase() ?? '';
    const mdLike =
      mimeType === 'text/markdown' ||
      mimeType === 'text/x-markdown' ||
      ext === 'md' ||
      ext === 'markdown';
    if (mdLike) return 'heading';
    if (text && /(?:^|\n)\s*#{1,6}\s+\S/.test(text.slice(0, 4000))) return 'heading';
    return 'fixed';
  }

  /** 固定长度切分 */
  private splitFixed(text: string, size: number, overlap: number): string[] {
    if (!text) return [];
    if (size <= 0) return [text];
    const safeOverlap = Math.max(0, Math.min(overlap, size - 1));
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + size, text.length);
      chunks.push(text.slice(start, end));
      if (end === text.length) break;
      start += size - safeOverlap;
      if (start <= 0 || start >= text.length) break;
    }
    return chunks;
  }

  /** 按 Markdown / 数字标题切分；过大段落再按 fixed 二次切分 */
  private splitByHeading(text: string, size: number, overlap: number): string[] {
    if (!text) return [];
    const pattern = /(?:\n|^)(?=\s*(?:#{1,6}\s+|\d+[.、]\s+\S|\S+\n={3,}|\S+\n-{3,}))/g;
    const parts = text.split(pattern).map((p) => p.trim()).filter((p) => p.length > 0);
    if (parts.length <= 1) return this.splitFixed(text, size, overlap);

    const result: string[] = [];
    for (const part of parts) {
      if (part.length <= size) {
        result.push(part);
      } else {
        result.push(...this.splitFixed(part, size, overlap));
      }
    }
    return result;
  }

  chunk(text: string, language: string | undefined, options: ChunkOptions = {}): ChunkCandidate[] {
    const size = options.size ?? this.defaultSize;
    const overlap = options.overlap ?? this.defaultOverlap;
    const maxChunks = options.maxChunks ?? this.defaultMaxChunks;
    const normalized = (text ?? '').replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    const strategy =
      !options.strategy || options.strategy === 'auto'
        ? this.recommendStrategy(options.mimeType, options.filename, normalized)
        : options.strategy;

    const rawChunks =
      strategy === 'heading'
        ? this.splitByHeading(normalized, size, overlap)
        : this.splitFixed(normalized, size, overlap);

    let position = 0;
    const candidates: ChunkCandidate[] = [];
    for (const content of rawChunks) {
      const trimmed = content.trim();
      if (!trimmed) {
        position += content.length;
        continue;
      }
      if (candidates.length >= maxChunks) break;

      const meta: ChunkMetadata = { strategy };
      const headingMatch = trimmed.match(/^(?:#{1,6}\s+|\d+[.、]\s+)?(.+)$/m);
      if (headingMatch) meta.heading = headingMatch[1].slice(0, 120);

      candidates.push({
        chunkIndex: candidates.length,
        position,
        language,
        tokenCount: this.estimateTokens(trimmed),
        content: trimmed,
        metadata: meta,
      });
      position += content.length;
    }
    return candidates;
  }

  hash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}
