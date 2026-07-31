import { BaseParser } from './base.parser';
import { ParsedDocument } from '../interfaces/document-parser.interface';

/**
 * 兜底解析器：无法识别的格式返回元数据，内容为空。
 * PPTX / 图片等格式在阶段 5 使用此兜底，OCR 预留。
 */
export class UnsupportedParser extends BaseParser {
  readonly supportedMimeTypes = ['*/*'];
  readonly supportedExtensions: string[] = [];

  constructor() {
    super(UnsupportedParser.name);
  }

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    return {
      title: filename,
      content: `[Unsupported format: ${this.fileExtension(filename)}]`,
      metadata: {
        filename,
        mimeType: 'application/octet-stream',
        sizeBytes: buffer.length,
        parsed: false,
      },
    };
  }
}
