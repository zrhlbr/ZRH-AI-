/**
 * Document Parser 统一接口。
 * 所有 Parser 必须实现本接口，禁止业务代码直接调用具体 Parser。
 */

export interface ParsedDocument {
  title: string;
  author?: string;
  language?: string;
  pages?: number;
  content: string;
  metadata: Record<string, unknown>;
}

export interface PreviewResult {
  title: string;
  snippet: string;
  pageCount?: number;
  metadata: Record<string, unknown>;
}

export interface DocumentParser {
  /** 支持的 MIME 类型列表 */
  readonly supportedMimeTypes: string[];

  /** 支持的文件扩展名列表 */
  readonly supportedExtensions: string[];

  /** 解析文件内容为纯文本与元数据 */
  parse(buffer: Buffer, filename: string): Promise<ParsedDocument>;

  /** 生成预览（前 N 字符 / 页） */
  preview(buffer: Buffer, filename: string, maxLength?: number): Promise<PreviewResult>;

  /** 提取元数据 */
  metadata(buffer: Buffer, filename: string): Promise<Record<string, unknown>>;
}

export const DOCUMENT_PARSER = Symbol('DOCUMENT_PARSER');
