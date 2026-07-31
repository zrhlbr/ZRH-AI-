import * as mammoth from 'mammoth';
import { BaseParser } from './base.parser';
import { ParsedDocument } from '../interfaces/document-parser.interface';

/**
 * DOCX 解析器
 */
export class DocxParser extends BaseParser {
  readonly supportedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];
  readonly supportedExtensions = ['docx', 'doc'];

  constructor() {
    super(DocxParser.name);
  }

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const result = await mammoth.extractRawText({ buffer });
    const content = result.value.replace(/\s+/g, ' ').trim();
    return {
      title: filename,
      content,
      language: this.detectLanguage(content),
      metadata: {
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: buffer.length,
      },
    };
  }
}
