import * as cheerio from 'cheerio';
import { BaseParser } from './base.parser';
import { ParsedDocument } from '../interfaces/document-parser.interface';

/**
 * HTML 解析器：提取标题与正文文本。
 */
export class HtmlParser extends BaseParser {
  readonly supportedMimeTypes = ['text/html', 'application/xhtml+xml'];
  readonly supportedExtensions = ['html', 'htm'];

  constructor() {
    super(HtmlParser.name);
  }

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const html = buffer.toString('utf-8');
    const $ = cheerio.load(html);
    const title = $('title').text().trim() || $('h1').first().text().trim() || filename;
    // 移除脚本与样式
    $('script, style, nav, footer, header, aside').remove();
    const content = $('body').text().replace(/\s+/g, ' ').trim();
    return {
      title,
      content,
      language: this.detectLanguage(content),
      metadata: { filename, mimeType: 'text/html', sizeBytes: buffer.length },
    };
  }
}
