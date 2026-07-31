-- CreateTable
CREATE TABLE "knowledge_folders" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" INTEGER NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'private',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_tags" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_document_tags" (
    "documentId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "knowledge_document_tags_pkey" PRIMARY KEY ("documentId","tagId")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" SERIAL NOT NULL,
    "folderId" INTEGER,
    "title" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "hash" TEXT NOT NULL,
    "author" TEXT,
    "source" TEXT,
    "language" TEXT,
    "ownerId" INTEGER NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'private',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currentVersionId" INTEGER,
    "versionCount" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_document_versions" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "storagePath" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "versionId" INTEGER NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "page" INTEGER,
    "position" INTEGER,
    "language" TEXT,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "hash" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embedding_providers" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "dimension" INTEGER NOT NULL DEFAULT 768,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "embedding_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vector_providers" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vector_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embedding_tasks" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerCode" TEXT NOT NULL,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "embedding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_permissions" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" INTEGER NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_folders_parentId_idx" ON "knowledge_folders"("parentId");

-- CreateIndex
CREATE INDEX "knowledge_folders_ownerId_idx" ON "knowledge_folders"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_tags_name_key" ON "knowledge_tags"("name");

-- CreateIndex
CREATE INDEX "knowledge_documents_folderId_idx" ON "knowledge_documents"("folderId");

-- CreateIndex
CREATE INDEX "knowledge_documents_ownerId_idx" ON "knowledge_documents"("ownerId");

-- CreateIndex
CREATE INDEX "knowledge_documents_status_idx" ON "knowledge_documents"("status");

-- CreateIndex
CREATE INDEX "knowledge_documents_permission_idx" ON "knowledge_documents"("permission");

-- CreateIndex
CREATE INDEX "knowledge_documents_isDeleted_idx" ON "knowledge_documents"("isDeleted");

-- CreateIndex
CREATE INDEX "knowledge_documents_isFavorite_idx" ON "knowledge_documents"("isFavorite");

-- CreateIndex
CREATE INDEX "knowledge_document_versions_documentId_idx" ON "knowledge_document_versions"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_document_versions_documentId_versionNumber_key" ON "knowledge_document_versions"("documentId", "versionNumber");

-- CreateIndex
CREATE INDEX "knowledge_chunks_documentId_idx" ON "knowledge_chunks"("documentId");

-- CreateIndex
CREATE INDEX "knowledge_chunks_versionId_idx" ON "knowledge_chunks"("versionId");

-- CreateIndex
CREATE INDEX "knowledge_chunks_hash_idx" ON "knowledge_chunks"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunks_versionId_chunkIndex_key" ON "knowledge_chunks"("versionId", "chunkIndex");

-- CreateIndex
CREATE UNIQUE INDEX "embedding_providers_code_key" ON "embedding_providers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "vector_providers_code_key" ON "vector_providers"("code");

-- CreateIndex
CREATE INDEX "embedding_tasks_documentId_idx" ON "embedding_tasks"("documentId");

-- CreateIndex
CREATE INDEX "embedding_tasks_status_idx" ON "embedding_tasks"("status");

-- CreateIndex
CREATE INDEX "document_permissions_documentId_idx" ON "document_permissions"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "document_permissions_documentId_targetType_targetId_key" ON "document_permissions"("documentId", "targetType", "targetId");

-- AddForeignKey
ALTER TABLE "knowledge_folders" ADD CONSTRAINT "knowledge_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "knowledge_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_folders" ADD CONSTRAINT "knowledge_folders_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_document_tags" ADD CONSTRAINT "knowledge_document_tags_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_document_tags" ADD CONSTRAINT "knowledge_document_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "knowledge_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "knowledge_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_document_versions" ADD CONSTRAINT "knowledge_document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "knowledge_document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embedding_tasks" ADD CONSTRAINT "embedding_tasks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 向量表（阶段 5 使用 JSONB 存储 embedding，避免依赖 pgvector 扩展；后续可切换到 pgvector）
CREATE TABLE "knowledge_vectors" (
    "id" SERIAL NOT NULL,
    "chunk_id" INTEGER NOT NULL,
    "embedding" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_vectors_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "knowledge_vectors_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "knowledge_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "knowledge_vectors_chunk_id_key" ON "knowledge_vectors"("chunk_id");
CREATE INDEX "knowledge_vectors_embedding_idx" ON "knowledge_vectors" USING GIN ("embedding");
