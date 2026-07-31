import { BaseParser } from './base.parser';
import { ParsedDocument } from '../interfaces/document-parser.interface';

/**
 * JSON 解析器：展平为文本。
 */
export class JsonParser extends BaseParser {
  readonly supportedMimeTypes = ['application/json'];
  readonly supportedExtensions = ['json'];

  constructor() {
    super(JsonParser.name);
  }

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const raw = buffer.toString('utf-8');
    const obj = JSON.parse(raw) as unknown;
    const content = this.flatten(obj);
    return {
      title: filename,
      content,
      language: this.detectLanguage(content),
      metadata: { filename, mimeType: 'application/json', sizeBytes: buffer.length },
    };
  }

  private flatten(value: unknown, depth = 3): string {
    if (depth <= 0) return '';
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map((v) => this.flatten(v, depth - 1)).join('\n');
    if (typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${this.flatten(v, depth - 1)}`)
        .join('\n');
    }
    return '';
  }
}
