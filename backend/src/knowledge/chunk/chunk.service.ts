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
  strategy?: 'fixed' | 'heading';
  size?: number;
  overlap?: number;
}

/**
 * Chunk Service：统一文本分块。
 * 支持固定长度切分与标题感知切分（预留语义切分接口）。
 */
@Injectable()
export class ChunkService {
  /** 简单 token 估算：1 token ≈ 4 字符（中英缅混合） */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /** 固定长度切分 */
  private splitFixed(text: string, size: number, overlap: number): string[] {
    if (size <= 0) return [text];
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + size, text.length);
      chunks.push(text.slice(start, end));
      if (end === text.length) break;
      start += size - overlap;
      if (start <= 0 || start >= text.length) break;
    }
    return chunks;
  }

  /** 按 Markdown / 数字标题切分 */
  private splitByHeading(text: string): string[] {
    // 匹配 # 标题、数字标题、空行分隔
    const pattern = /(?:\n|^)(?=\s*(?:#{1,6}\s+|\d+[.、]\s+\S|\S+\n={3,}|\S+\n-{3,}))/g;
    const parts = text.split(pattern).filter((s) => s.trim());
    if (parts.length <= 1) return [text];
    return parts.map((p) => p.trim()).filter((p) => p.length > 0);
  }

  chunk(text: string, language: string | undefined, options: ChunkOptions = {}): ChunkCandidate[] {
    const { strategy = 'fixed', size = 800, overlap = 80 } = options;
    const rawChunks = strategy === 'heading' ? this.splitByHeading(text) : this.splitFixed(text, size, overlap);

    let position = 0;
    return rawChunks.map((content, index) => {
      const trimmed = content.trim();
      const tokenCount = this.estimateTokens(trimmed);
      const meta: ChunkMetadata = {};
      // 提取标题
      const headingMatch = trimmed.match(/^(?:#{1,6}\s+|\d+[.、]\s+)?(.+)$/m);
      if (headingMatch) meta.heading = headingMatch[1].slice(0, 120);

      const candidate: ChunkCandidate = {
        chunkIndex: index,
        position,
        language,
        tokenCount,
        content: trimmed,
        metadata: meta,
      };
      position += content.length;
      return candidate;
    });
  }

  hash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}
