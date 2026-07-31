import { PDFParse } from 'pdf-parse';
import { BaseParser } from './base.parser';
import { ParsedDocument } from '../interfaces/document-parser.interface';

/**
 * PDF 解析器（基于 pdf-parse 新版 class API）
 */
export class PdfParser extends BaseParser {
  readonly supportedMimeTypes = ['application/pdf'];
  readonly supportedExtensions = ['pdf'];

  constructor() {
    super(PdfParser.name);
  }

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const parser = new PDFParse({ data: buffer });
    try {
      const textResult = await parser.getText();
      const infoResult = await parser.getInfo();
      const content = (textResult.text || '').replace(/\s+/g, ' ').trim();
      const info = infoResult.info || {};
      return {
        title: info?.Title?.toString() || filename,
        author: info?.Author?.toString(),
        content,
        pages: textResult.total || 0,
        language: this.detectLanguage(content),
        metadata: {
          filename,
          mimeType: 'application/pdf',
          sizeBytes: buffer.length,
          pages: textResult.total || 0,
          author: info?.Author,
        },
      };
    } finally {
      await parser.destroy();
    }
  }
}
