import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ParserService } from '../parser/parser.service';
import { ChunkService } from '../chunk/chunk.service';
import { OllamaEmbeddingProvider } from '../embedding/ollama-embedding.provider';
import { PgvectorProvider } from '../vector/pgvector.provider';
import { EmbeddingTaskService } from '../tasks/embedding-task.service';
import { KnowledgePermissionService, PermissionCheck } from '../permissions/permission.service';
import { PermissionScope, TaskStatus } from '../types/knowledge.types';

export interface UploadResult {
  documentId: number;
  versionId: number;
  taskId: number;
  title: string;
  status: string;
}

/**
 * Knowledge Document Service：Document Center 核心业务。
 * 负责上传、解析、分块、Embedding、版本、回收站、权限等。
 */
@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly parser: ParserService,
    private readonly chunk: ChunkService,
    private readonly embedding: OllamaEmbeddingProvider,
    private readonly vector: PgvectorProvider,
    private readonly tasks: EmbeddingTaskService,
    private readonly permissions: KnowledgePermissionService,
  ) {}

  // ---------- Folder ----------

  async createFolder(
    userId: number,
    data: {
      name: string;
      parentId?: number;
      permission?: PermissionScope;
      description?: string;
      sortOrder?: number;
    },
  ) {
    if (data.parentId) {
      const can = await this.permissions.canAccessFolder(data.parentId, { userId });
      if (!can) throw new ForbiddenException('no permission to create folder here');
    }
    return this.prisma.knowledgeFolder.create({
      data: {
        name: data.name,
        parentId: data.parentId ?? null,
        ownerId: userId,
        permission: data.permission ?? 'private',
        description: data.description ?? null,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async listFolders(userId: number, parentId?: number) {
    const folders = await this.prisma.knowledgeFolder.findMany({
      where: {
        parentId: parentId ?? null,
        OR: [{ ownerId: userId }, { permission: { in: ['public', 'company'] } }],
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return folders;
  }

  async updateFolder(userId: number, id: number, data: Partial<{ name: string; parentId: number | null; permission: PermissionScope }>) {
    const folder = await this.prisma.knowledgeFolder.findUnique({ where: { id } });
    if (!folder) throw new NotFoundException('folder not found');
    if (folder.ownerId !== userId) throw new ForbiddenException('no permission');
    return this.prisma.knowledgeFolder.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
        ...(data.permission ? { permission: data.permission } : {}),
      },
    });
  }

  async deleteFolder(userId: number, id: number) {
    const folder = await this.prisma.knowledgeFolder.findUnique({ where: { id }, include: { children: true, documents: true } });
    if (!folder) throw new NotFoundException('folder not found');
    if (folder.ownerId !== userId) throw new ForbiddenException('no permission');
    if (folder.children.length > 0 || folder.documents.length > 0) {
      throw new BadRequestException('folder is not empty');
    }
    return this.prisma.knowledgeFolder.delete({ where: { id } });
  }

  // ---------- Document Upload / Parse / Chunk / Embed ----------

  async upload(
    userId: number,
    file: Express.Multer.File,
    opts: { folderId?: number; title?: string; author?: string; source?: string; tags?: number[]; permission?: PermissionScope } = {},
  ): Promise<UploadResult> {
    if (opts.folderId) {
      const can = await this.permissions.canAccessFolder(opts.folderId, { userId });
      if (!can) throw new ForbiddenException('no permission to upload here');
    }

    const stored = await this.storage.save(file.buffer, file.originalname);
    const parsed = await this.parser.parse(file.buffer, file.mimetype, file.originalname);

    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        folderId: opts.folderId ?? null,
        title: opts.title || parsed.title || file.originalname,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: BigInt(stored.sizeBytes),
        hash: stored.hash,
        author: opts.author || parsed.author || null,
        source: opts.source || null,
        language: parsed.language || null,
        ownerId: userId,
        permission: opts.permission ?? 'private',
        status: 'parsing',
      },
    });

    const version = await this.prisma.knowledgeDocumentVersion.create({
      data: {
        documentId: doc.id,
        versionNumber: 1,
        storagePath: stored.storagePath,
        sizeBytes: BigInt(stored.sizeBytes),
        hash: stored.hash,
        createdBy: userId,
      },
    });

    await this.prisma.knowledgeDocument.update({
      where: { id: doc.id },
      data: { currentVersionId: version.id, versionCount: 1 },
    });

    if (opts.tags?.length) {
      await this.prisma.knowledgeDocumentTag.createMany({
        data: opts.tags.map((tagId) => ({ documentId: doc.id, tagId })),
        skipDuplicates: true,
      });
    }

    // 自动解析 + 分块
    await this.runParseAndChunk(doc.id, version.id, file.buffer, file.mimetype, file.originalname, parsed);

    // 创建 embedding 任务（由 Stage 6 Embedding Worker 后台执行）
    const task = await this.tasks.create(doc.id, this.embedding.code);

    return {
      documentId: doc.id,
      versionId: version.id,
      taskId: task.id,
      title: doc.title,
      status: 'chunked',
    };
  }

  /** 重解析前清理版本下旧 chunk + 向量，避免唯一约束冲突 */
  private async clearVersionChunks(versionId: number) {
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: { versionId },
      select: { id: true },
    });
    if (chunks.length === 0) return;
    await this.vector.delete(chunks.map((c) => c.id));
    await this.prisma.knowledgeChunk.deleteMany({ where: { versionId } });
  }

  private async runParseAndChunk(
    documentId: number,
    versionId: number,
    buffer: Buffer,
    mimeType: string,
    filename: string,
    parsed?: { content: string; language?: string; pages?: number },
  ) {
    await this.prisma.knowledgeDocument.update({ where: { id: documentId }, data: { status: 'parsing' } });
    await this.clearVersionChunks(versionId);
    const doc = parsed ?? (await this.parser.parse(buffer, mimeType, filename));
    const candidates = this.chunk.chunk(doc.content, doc.language, {
      strategy: 'auto',
      size: 800,
      overlap: 80,
      mimeType,
      filename,
    });

    if (candidates.length > 0) {
      await this.prisma.knowledgeChunk.createMany({
        data: candidates.map((c) => ({
          documentId,
          versionId,
          chunkIndex: c.chunkIndex,
          page: c.page ?? null,
          position: c.position ?? null,
          language: c.language ?? null,
          tokenCount: c.tokenCount,
          hash: this.chunk.hash(c.content),
          content: c.content,
          metadata: c.metadata as Prisma.InputJsonValue,
        })),
      });
    }

    await this.prisma.knowledgeDocument.update({ where: { id: documentId }, data: { status: 'chunked' } });
  }

  /** Stage 6 Worker 入口：处理单个 embedding / rebuild 任务 */
  async processEmbeddingTask(taskId: number): Promise<{ taskId: number; status: string }> {
    const task = await this.prisma.embeddingTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('embedding task not found');
    if (task.status === 'running' || task.status === 'completed') {
      return { taskId, status: task.status };
    }

    const doc = await this.prisma.knowledgeDocument.findUnique({
      where: { id: task.documentId },
      include: { versions: true },
    });
    if (!doc) {
      await this.tasks.fail(taskId, 'document not found');
      return { taskId, status: 'failed' };
    }
    const version = doc.versions.find((v) => v.id === doc.currentVersionId) ?? doc.versions[0];
    if (!version) {
      await this.tasks.fail(taskId, 'version not found');
      return { taskId, status: 'failed' };
    }

    await this.runEmbedding(taskId, doc.id, version.id);
    const updated = await this.prisma.embeddingTask.findUnique({ where: { id: taskId } });
    return { taskId, status: updated?.status ?? 'failed' };
  }

  private async runEmbedding(taskId: number, documentId: number, versionId: number) {
    await this.tasks.start(taskId);
    try {
      await this.prisma.knowledgeDocument.update({ where: { id: documentId }, data: { status: 'embedding' } });
      await this.vector.initialize(this.embedding.dimension);

      const chunks = await this.prisma.knowledgeChunk.findMany({ where: { versionId } });
      const batchSize = 16;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const embeddings = await this.embedding.embedBatch(batch.map((c) => c.content));
        await this.vector.insert(
          batch.map((c, idx) => ({ chunkId: c.id, embedding: embeddings[idx] })),
        );
      }

      await this.prisma.knowledgeDocument.update({ where: { id: documentId }, data: { status: 'indexed' } });
      await this.tasks.complete(taskId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.tasks.fail(taskId, message);
      await this.prisma.knowledgeDocument.update({ where: { id: documentId }, data: { status: 'error' } });
    }
  }

  // ---------- Document CRUD ----------

  async listDocuments(
    userId: number,
    opts: {
      folderId?: number;
      search?: string;
      status?: string;
      favorite?: boolean;
      trash?: boolean;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const baseFilter = opts.trash
      ? ({ isDeleted: true, ownerId: userId } as Prisma.KnowledgeDocumentWhereInput)
      : await this.permissions.buildDocumentFilter(userId);
    const where: Prisma.KnowledgeDocumentWhereInput = {
      ...baseFilter,
      ...(opts.folderId !== undefined ? { folderId: opts.folderId } : {}),
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.favorite ? { isFavorite: true } : {}),
      ...(opts.search
        ? {
            OR: [
              { title: { contains: opts.search, mode: 'insensitive' } },
              { filename: { contains: opts.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.knowledgeDocument.count({ where }),
      this.prisma.knowledgeDocument.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ isFavorite: 'desc' }, { updatedAt: 'desc' }],
        include: { tags: { include: { tag: true } }, folder: true },
      }),
    ]);

    return {
      page,
      pageSize,
      total,
      items: items.map((d) => ({
        ...d,
        sizeBytes: Number(d.sizeBytes),
        tags: d.tags.map((t) => t.tag),
      })),
    };
  }

  async getDocument(userId: number, id: number) {
    const doc = await this.prisma.knowledgeDocument.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } }, versions: true, folder: true },
    });
    if (!doc) throw new NotFoundException('document not found');
    const can = await this.permissions.canAccessDocument(id, { userId }, 'read');
    if (!can) throw new ForbiddenException('no permission');
    return { ...doc, sizeBytes: Number(doc.sizeBytes), tags: doc.tags.map((t) => t.tag) };
  }

  async previewDocument(userId: number, id: number, maxLength = 1000) {
    const doc = await this.getDocument(userId, id);
    const version = doc.versions.find((v) => v.id === doc.currentVersionId) ?? doc.versions[0];
    if (!version) throw new NotFoundException('version not found');
    const buffer = await this.storage.read(version.storagePath);
    const preview = await this.parser.preview(buffer, doc.mimeType, doc.filename, maxLength);
    return preview;
  }

  async updateDocument(userId: number, id: number, data: Partial<{ title: string; folderId: number | null; tags: number[]; isFavorite: boolean; permission: PermissionScope; author: string; source: string }>) {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('document not found');
    if (doc.ownerId !== userId) throw new ForbiddenException('no permission');

    const update: Prisma.KnowledgeDocumentUpdateInput = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.folderId !== undefined) {
      update.folder = data.folderId === null ? { disconnect: true } : { connect: { id: data.folderId } };
    }
    if (data.isFavorite !== undefined) update.isFavorite = data.isFavorite;
    if (data.permission !== undefined) update.permission = data.permission;
    if (data.author !== undefined) update.author = data.author;
    if (data.source !== undefined) update.source = data.source;

    const updated = await this.prisma.knowledgeDocument.update({ where: { id }, data: update });

    if (data.tags) {
      await this.prisma.knowledgeDocumentTag.deleteMany({ where: { documentId: id } });
      if (data.tags.length > 0) {
        await this.prisma.knowledgeDocumentTag.createMany({
          data: data.tags.map((tagId) => ({ documentId: id, tagId })),
          skipDuplicates: true,
        });
      }
    }

    return { ...updated, sizeBytes: Number(updated.sizeBytes) };
  }

  async moveDocument(userId: number, id: number, folderId: number | null) {
    return this.updateDocument(userId, id, { folderId });
  }

  async copyDocument(userId: number, id: number, targetFolderId?: number) {
    const doc = await this.getDocument(userId, id);
    const version = doc.versions.find((v) => v.id === doc.currentVersionId) ?? doc.versions[0];
    if (!version) throw new NotFoundException('version not found');
    const buffer = await this.storage.read(version.storagePath);
    return this.upload(
      userId,
      { buffer, originalname: doc.filename, mimetype: doc.mimeType, size: Number(doc.sizeBytes) } as Express.Multer.File,
      {
        folderId: targetFolderId ?? (doc.folderId ?? undefined),
        title: `${doc.title} (copy)`,
        author: doc.author ?? undefined,
        source: doc.source ?? undefined,
        tags: doc.tags.map((t) => t.id),
        permission: doc.permission as PermissionScope,
      },
    );
  }

  async deleteDocument(userId: number, id: number, permanent = false) {
    const doc = await this.prisma.knowledgeDocument.findUnique({
      where: { id },
      include: { versions: true },
    });
    if (!doc) throw new NotFoundException('document not found');
    if (doc.ownerId !== userId) throw new ForbiddenException('no permission');
    if (permanent) {
      for (const version of doc.versions) {
        await this.clearVersionChunks(version.id);
        await this.storage.delete(version.storagePath);
      }
      await this.prisma.knowledgeDocument.delete({ where: { id } });
      return { deleted: true, permanent: true };
    }
    await this.prisma.knowledgeDocument.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    return { deleted: true, permanent: false };
  }

  async restoreDocument(userId: number, id: number) {
    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('document not found');
    if (doc.ownerId !== userId) throw new ForbiddenException('no permission');
    return this.prisma.knowledgeDocument.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null },
    });
  }

  // ---------- Tags ----------

  async createTag(name: string, color?: string) {
    return this.prisma.knowledgeTag.create({
      data: { name: name.trim(), color },
    });
  }

  async listTags() {
    return this.prisma.knowledgeTag.findMany({ orderBy: { name: 'asc' } });
  }

  // ---------- Manual pipeline steps ----------

  async parseAndChunkDocument(userId: number, id: number) {
    const doc = await this.getDocument(userId, id);
    if (doc.ownerId !== userId) throw new ForbiddenException('no permission');
    const version = doc.versions.find((v) => v.id === doc.currentVersionId) ?? doc.versions[0];
    if (!version) throw new NotFoundException('version not found');
    const buffer = await this.storage.read(version.storagePath);
    await this.runParseAndChunk(doc.id, version.id, buffer, doc.mimeType, doc.filename);
    return { documentId: doc.id, status: 'chunked' };
  }

  async reindexDocument(userId: number, id: number) {
    const doc = await this.getDocument(userId, id);
    if (doc.ownerId !== userId) throw new ForbiddenException('no permission');
    const version = doc.versions.find((v) => v.id === doc.currentVersionId) ?? doc.versions[0];
    if (!version) throw new NotFoundException('version not found');

    // 清理旧向量（保留 chunk，仅重建 embedding）
    const chunks = await this.prisma.knowledgeChunk.findMany({ where: { versionId: version.id } });
    if (chunks.length === 0) {
      throw new BadRequestException('no chunks to reindex; parse document first');
    }
    await this.vector.delete(chunks.map((c) => c.id));

    const task = await this.tasks.create(doc.id, this.embedding.code);
    return { documentId: doc.id, taskId: task.id, status: 'pending' };
  }

  // ---------- Download ----------

  async download(userId: number, id: number) {
    const doc = await this.getDocument(userId, id);
    const version = doc.versions.find((v) => v.id === doc.currentVersionId) ?? doc.versions[0];
    if (!version) throw new NotFoundException('version not found');
    const buffer = await this.storage.read(version.storagePath);
    return { buffer, filename: doc.filename, mimeType: doc.mimeType };
  }
}
