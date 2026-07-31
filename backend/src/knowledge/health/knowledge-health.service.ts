import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OllamaEmbeddingProvider } from '../embedding/ollama-embedding.provider';
import { PgvectorProvider } from '../vector/pgvector.provider';

/**
 * Knowledge Center 健康与统计（V1.1 P1）
 * 提供文档/Chunk/Vector/Embedding 状态、来源与分类统计，供后台观测。
 */
@Injectable()
export class KnowledgeHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: OllamaEmbeddingProvider,
    private readonly vector: PgvectorProvider,
  ) {}

  async status() {
    const [
      documentCount,
      chunkCount,
      vectorCount,
      embeddingHealth,
      vectorHealth,
      byStatus,
      bySource,
      byLanguage,
      byPermission,
      embeddingTasks,
      recentDocs,
      folders,
    ] = await Promise.all([
      this.prisma.knowledgeDocument.count({ where: { isDeleted: false } }),
      this.prisma.knowledgeChunk.count(),
      this.prisma.$queryRawUnsafe<{ count: bigint | number }[]>(
        `SELECT COUNT(*) as count FROM "knowledge_vectors"`,
      ),
      this.embedding.health(),
      this.vector.health(),
      this.prisma.knowledgeDocument.groupBy({
        by: ['status'],
        where: { isDeleted: false },
        _count: { _all: true },
      }),
      this.prisma.knowledgeDocument.groupBy({
        by: ['source'],
        where: { isDeleted: false },
        _count: { _all: true },
      }),
      this.prisma.knowledgeDocument.groupBy({
        by: ['language'],
        where: { isDeleted: false },
        _count: { _all: true },
      }),
      this.prisma.knowledgeDocument.groupBy({
        by: ['permission'],
        where: { isDeleted: false },
        _count: { _all: true },
      }),
      this.prisma.embeddingTask.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.knowledgeDocument.findMany({
        where: { isDeleted: false },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          title: true,
          source: true,
          language: true,
          permission: true,
          status: true,
          folderId: true,
          versionCount: true,
          updatedAt: true,
          folder: { select: { id: true, name: true } },
        },
      }),
      this.prisma.knowledgeFolder.findMany({
        select: { id: true, name: true, parentId: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    ]);

    const vectors = Number(vectorCount[0]?.count ?? 0);

    const folderDocCounts = await this.prisma.knowledgeDocument.groupBy({
      by: ['folderId'],
      where: { isDeleted: false },
      _count: { _all: true },
    });
    const folderChunkRows = await this.prisma.$queryRawUnsafe<
      Array<{ folderId: number | null; chunks: bigint | number }>
    >(
      `SELECT d."folderId" AS "folderId", COUNT(c.id) AS chunks
       FROM knowledge_chunks c
       INNER JOIN knowledge_documents d ON d.id = c."documentId"
       WHERE d."isDeleted" = false
       GROUP BY d."folderId"`,
    );
    const folderVectorRows = await this.prisma.$queryRawUnsafe<
      Array<{ folderId: number | null; vectors: bigint | number }>
    >(
      `SELECT d."folderId" AS "folderId", COUNT(kv.id) AS vectors
       FROM knowledge_vectors kv
       INNER JOIN knowledge_chunks c ON c.id = kv.chunk_id
       INNER JOIN knowledge_documents d ON d.id = c."documentId"
       WHERE d."isDeleted" = false
       GROUP BY d."folderId"`,
    );

    const chunkMap = new Map(folderChunkRows.map((r) => [r.folderId, Number(r.chunks)]));
    const vectorMap = new Map(folderVectorRows.map((r) => [r.folderId, Number(r.vectors)]));
    const docMap = new Map(folderDocCounts.map((r) => [r.folderId, r._count._all]));

    const rootFolders = folders.filter((f) => f.parentId == null);
    const byCategory = rootFolders.map((root) => {
      const childIds = new Set<number>([root.id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const f of folders) {
          if (f.parentId != null && childIds.has(f.parentId) && !childIds.has(f.id)) {
            childIds.add(f.id);
            grew = true;
          }
        }
      }
      let documents = 0;
      let chunks = 0;
      let folderVectors = 0;
      for (const id of childIds) {
        documents += docMap.get(id) ?? 0;
        chunks += chunkMap.get(id) ?? 0;
        folderVectors += vectorMap.get(id) ?? 0;
      }
      return {
        folderId: root.id,
        name: root.name,
        documents,
        chunks,
        vectors: folderVectors,
        children: folders.filter((f) => f.parentId === root.id).map((f) => f.name),
      };
    });

    const taskStats = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
    };
    for (const row of embeddingTasks) {
      const key = row.status as keyof typeof taskStats;
      if (key in taskStats) taskStats[key] = row._count._all;
    }

    return {
      documents: documentCount,
      chunks: chunkCount,
      vectors,
      embeddings: vectors, // 当前实现一对一：每条向量对应一次 embedding 结果
      parser: {
        ok: true,
        supportedFormats: ['txt', 'md', 'html', 'json', 'xml', 'csv', 'pdf', 'docx', 'xlsx', 'zip'],
      },
      embedding: {
        ok: embeddingHealth.status === 'online',
        provider: this.embedding.code,
        latencyMs: embeddingHealth.latencyMs,
        error: embeddingHealth.error,
        tasks: taskStats,
      },
      vector: {
        ok: vectorHealth.status === 'online',
        provider: this.vector.code,
        count: vectorHealth.count ?? vectors,
        error: vectorHealth.error,
      },
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
      bySource: bySource.map((r) => ({
        source: r.source ?? 'UNSPECIFIED',
        count: r._count._all,
      })),
      byLanguage: byLanguage.map((r) => ({
        language: r.language ?? 'unknown',
        count: r._count._all,
      })),
      byPermission: byPermission.map((r) => ({
        permission: r.permission,
        count: r._count._all,
      })),
      byCategory,
      recentUpdates: recentDocs.map((d) => ({
        id: d.id,
        title: d.title,
        source: d.source,
        language: d.language,
        permission: d.permission,
        status: d.status,
        version: d.versionCount,
        folder: d.folder?.name ?? null,
        updatedAt: d.updatedAt,
      })),
    };
  }
}
