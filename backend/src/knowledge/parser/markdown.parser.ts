import { BaseParser } from './base.parser';
import { ParsedDocument } from '../interfaces/document-parser.interface';

/**
 * Markdown 解析器：
 * - 去除链接/加粗/代码块等格式噪声
 * - 保留 ATX 标题（# / ##）与条目编号，供 Knowledge Chunk 按标题切分（V1.1 P1）
 */
export class MarkdownParser extends BaseParser {
  readonly supportedMimeTypes = ['text/markdown', 'text/x-markdown'];
  readonly supportedExtensions = ['md', 'markdown'];

  constructor() {
    super(MarkdownParser.name);
  }

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const raw = buffer.toString('utf-8');
    const content = raw
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^\s*[-*+]\s+/gm, '');

    const titleMatch = raw.match(/^#\s+(.+)$/m);
    return {
      title: titleMatch?.[1]?.trim() ?? filename,
      content: content.trim(),
      language: this.detectLanguage(content),
      metadata: { filename, mimeType: 'text/markdown', sizeBytes: buffer.length },
    };
  }
}
