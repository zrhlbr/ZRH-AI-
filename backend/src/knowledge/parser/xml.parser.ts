import { BaseParser } from './base.parser';
import { ParsedDocument } from '../interfaces/document-parser.interface';

/**
 * XML 解析器：提取标签文本内容。
 */
export class XmlParser extends BaseParser {
  readonly supportedMimeTypes = ['application/xml', 'text/xml'];
  readonly supportedExtensions = ['xml'];

  constructor() {
    super(XmlParser.name);
  }

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const raw = buffer.toString('utf-8');
    // 去除标签，保留文本节点
    const content = raw
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      title: filename,
      content,
      language: this.detectLanguage(content),
      metadata: { filename, mimeType: 'application/xml', sizeBytes: buffer.length },
    };
  }
}
