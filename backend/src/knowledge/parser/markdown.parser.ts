import { BaseParser } from './base.parser';
import { ParsedDocument } from '../interfaces/document-parser.interface';

/**
 * Markdown 解析器：保留文本，去除格式标记。
 */
export class MarkdownParser extends BaseParser {
  readonly supportedMimeTypes = ['text/markdown', 'text/x-markdown'];
  readonly supportedExtensions = ['md', 'markdown'];

  constructor() {
    super(MarkdownParser.name);
  }

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const raw = buffer.toString('utf-8');
    // 简单清洗：去除链接、图片、粗体、斜体、代码块标记，保留文本
    let content = raw
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/(\*\*|__|\*|_|`)/g, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1');

    const titleMatch = raw.match(/^#\s+(.+)$/m);
    return {
      title: titleMatch?.[1]?.trim() ?? filename,
      content: content.trim(),
      language: this.detectLanguage(content),
      metadata: { filename, mimeType: 'text/markdown', sizeBytes: buffer.length },
    };
  }
}
