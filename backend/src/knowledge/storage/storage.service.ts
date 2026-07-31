import { Injectable, Logger } from '@nestjs/common';
import { createWriteStream, createReadStream, promises as fs } from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';

/**
 * Knowledge Storage Service：本地文件存储抽象层。
 * 后续可替换为 MinIO / S3 / NAS 等，业务代码不直接操作文件系统。
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly baseDir: string;

  constructor() {
    this.baseDir = process.env.KNOWLEDGE_STORAGE_PATH ?? path.join(process.cwd(), 'storage', 'documents');
  }

  private hashPath(hash: string): string {
    // 前两位做目录打散，避免单目录文件过多
    return path.join(hash.slice(0, 2), hash.slice(2, 4), hash);
  }

  private async ensureDir(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  async save(buffer: Buffer, filename: string): Promise<{ storagePath: string; hash: string; sizeBytes: number }> {
    const hash = createHash('sha256').update(buffer).digest('hex');
    const relative = this.hashPath(hash);
    const filePath = path.join(this.baseDir, relative);
    await this.ensureDir(filePath);
    await fs.writeFile(filePath, buffer);
    this.logger.log(`saved ${filename} -> ${relative}`);
    return { storagePath: relative, hash, sizeBytes: buffer.length };
  }

  async read(storagePath: string): Promise<Buffer> {
    const filePath = path.join(this.baseDir, storagePath);
    return fs.readFile(filePath);
  }

  async stream(storagePath: string): Promise<NodeJS.ReadableStream> {
    const filePath = path.join(this.baseDir, storagePath);
    return createReadStream(filePath);
  }

  async delete(storagePath: string): Promise<void> {
    const filePath = path.join(this.baseDir, storagePath);
    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`delete failed: ${message}`);
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.baseDir, storagePath));
      return true;
    } catch {
      return false;
    }
  }
}
