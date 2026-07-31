import { Injectable, Logger } from '@nestjs/common';
import {
  BaseParser,
  TextParser,
  MarkdownParser,
  HtmlParser,
  JsonParser,
  XmlParser,
  CsvParser,
  PdfParser,
  DocxParser,
  XlsxParser,
  ZipParser,
  UnsupportedParser,
} from './parsers.index';
import { DocumentParser, ParsedDocument, PreviewResult } from '../interfaces/document-parser.interface';

/**
 * Parser Pipeline：统一管理所有 DocumentParser。
 * 根据 MIME 类型与扩展名自动选择 Parser。
 */
@Injectable()
export class ParserService {
  private readonly logger = new Logger(ParserService.name);
  private readonly parsers: DocumentParser[];
  private readonly fallback = new UnsupportedParser();

  constructor() {
    this.parsers = [
      new TextParser(),
      new MarkdownParser(),
      new HtmlParser(),
      new JsonParser(),
      new XmlParser(),
      new CsvParser(),
      new PdfParser(),
      new DocxParser(),
      new XlsxParser(),
      new ZipParser(),
    ];
  }

  private extension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  }

  private findParser(mimeType: string, filename: string): DocumentParser {
    const ext = this.extension(filename);
    return (
      this.parsers.find((p) => p.supportedMimeTypes.includes(mimeType)) ??
      this.parsers.find((p) => p.supportedExtensions.includes(ext)) ??
      this.fallback
    );
  }

  async parse(buffer: Buffer, mimeType: string, filename: string): Promise<ParsedDocument> {
    const parser = this.findParser(mimeType, filename);
    this.logger.log(`parsing ${filename} with ${parser.constructor.name}`);
    return parser.parse(buffer, filename);
  }

  async preview(buffer: Buffer, mimeType: string, filename: string, maxLength = 1000): Promise<PreviewResult> {
    const parser = this.findParser(mimeType, filename);
    return parser.preview(buffer, filename, maxLength);
  }

  async metadata(buffer: Buffer, mimeType: string, filename: string): Promise<Record<string, unknown>> {
    const parser = this.findParser(mimeType, filename);
    return parser.metadata(buffer, filename);
  }

  supportedFormats(): Array<{ mimeType: string; extensions: string[] }> {
    return this.parsers.map((p) => ({
      mimeType: p.supportedMimeTypes[0],
      extensions: p.supportedExtensions,
    }));
  }
}
