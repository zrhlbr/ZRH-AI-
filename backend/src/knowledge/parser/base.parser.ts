import { Logger } from '@nestjs/common';
import { DocumentParser, ParsedDocument, PreviewResult } from '../interfaces/document-parser.interface';

/**
 * Parser 抽象基类，提供通用工具方法。
 */
export abstract class BaseParser implements DocumentParser {
  protected readonly logger: Logger;
  abstract readonly supportedMimeTypes: string[];
  abstract readonly supportedExtensions: string[];

  protected constructor(loggerName: string) {
    this.logger = new Logger(loggerName);
  }

  abstract parse(buffer: Buffer, filename: string): Promise<ParsedDocument>;

  async preview(buffer: Buffer, filename: string, maxLength = 1000): Promise<PreviewResult> {
    const doc = await this.parse(buffer, filename);
    return {
      title: doc.title,
      snippet: doc.content.slice(0, maxLength),
      pageCount: doc.pages,
      metadata: doc.metadata,
    };
  }

  async metadata(buffer: Buffer, filename: string): Promise<Record<string, unknown>> {
    const doc = await this.parse(buffer, filename);
    return doc.metadata;
  }

  protected detectLanguage(text: string): string {
    // 简单启发式：中文字符 → zh-CN，缅文 → my-MM，否则 en-US
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
    if (/[\u1000-\u109f]/.test(text)) return 'my-MM';
    return 'en-US';
  }

  protected fileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  }
}
