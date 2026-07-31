import AdmZip from 'adm-zip';
import { BaseParser } from './base.parser';
import { ParsedDocument } from '../interfaces/document-parser.interface';

/**
 * ZIP 解析器：列出内部文件并提取文本文件内容。
 */
export class ZipParser extends BaseParser {
  readonly supportedMimeTypes = ['application/zip'];
  readonly supportedExtensions = ['zip'];

  constructor() {
    super(ZipParser.name);
  }

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    const textEntries = entries.filter((e: AdmZip.IZipEntry) => !e.isDirectory && e.header.size > 0);
    const lines: string[] = [];
    const fileList: string[] = [];
    for (const entry of textEntries) {
      fileList.push(entry.entryName);
      try {
        const data = entry.getData();
        // 仅尝试提取文本文件
        const text = data.toString('utf-8');
        if (text && !text.includes('\u0000')) {
          lines.push(`--- ${entry.entryName} ---`);
          lines.push(text.slice(0, 5000));
        }
      } catch {
        // 二进制文件跳过
      }
    }
    const content = lines.join('\n');
    return {
      title: filename,
      content: content || `ZIP contains ${fileList.length} files`,
      language: this.detectLanguage(content),
      metadata: {
        filename,
        mimeType: 'application/zip',
        sizeBytes: buffer.length,
        files: fileList,
      },
    };
  }
}
