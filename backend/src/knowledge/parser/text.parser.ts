import { BaseParser } from './base.parser';
import { ParsedDocument } from '../interfaces/document-parser.interface';

/**
 * 纯文本 / TXT 解析器
 */
export class TextParser extends BaseParser {
  readonly supportedMimeTypes = ['text/plain'];
  readonly supportedExtensions = ['txt'];

  constructor() {
    super(TextParser.name);
  }

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const content = buffer.toString('utf-8');
    return {
      title: filename,
      content,
      language: this.detectLanguage(content),
      metadata: { filename, mimeType: 'text/plain', sizeBytes: buffer.length },
    };
  }
}
