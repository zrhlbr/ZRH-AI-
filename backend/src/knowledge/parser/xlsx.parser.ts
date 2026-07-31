import * as XLSX from 'xlsx';
import { BaseParser } from './base.parser';
import { ParsedDocument } from '../interfaces/document-parser.interface';

/**
 * XLSX / XLS / CSV（兜底）解析器
 */
export class XlsxParser extends BaseParser {
  readonly supportedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  readonly supportedExtensions = ['xlsx', 'xls'];

  constructor() {
    super(XlsxParser.name);
  }

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      lines.push(`Sheet: ${sheetName}`);
      for (const row of json) {
        lines.push(row.map((cell) => String(cell ?? '')).join(' | '));
      }
    }
    const content = lines.join('\n');
    return {
      title: filename,
      content,
      language: this.detectLanguage(content),
      metadata: {
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sizeBytes: buffer.length,
        sheets: workbook.SheetNames,
      },
    };
  }
}
