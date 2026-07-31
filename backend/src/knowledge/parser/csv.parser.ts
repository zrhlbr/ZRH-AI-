import { BaseParser } from './base.parser';
import { ParsedDocument } from '../interfaces/document-parser.interface';

/**
 * CSV 解析器：按行合并为文本。
 */
export class CsvParser extends BaseParser {
  readonly supportedMimeTypes = ['text/csv'];
  readonly supportedExtensions = ['csv'];

  constructor() {
    super(CsvParser.name);
  }

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const raw = buffer.toString('utf-8');
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    const delimiter = lines[0]?.includes('\t') ? '\t' : ',';
    const content = lines
      .map((line) =>
        line
          .split(delimiter)
          .map((cell) => cell.replace(/^"|"$/g, '').trim())
          .join(' | '),
      )
      .join('\n');
    return {
      title: filename,
      content,
      language: this.detectLanguage(content),
      metadata: { filename, mimeType: 'text/csv', sizeBytes: buffer.length, rows: lines.length },
    };
  }
}
