-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_synonyms" (
    "id" SERIAL NOT NULL,
    "term" TEXT NOT NULL,
    "synonyms" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'zh-CN',
    "category" TEXT NOT NULL DEFAULT 'synonym',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rag_synonyms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_query_logs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "conversationId" INTEGER,
    "originalQuery" TEXT NOT NULL,
    "rewrittenQuery" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "retrieveCount" INTEGER NOT NULL DEFAULT 0,
    "rerankCount" INTEGER NOT NULL DEFAULT 0,
    "citationCount" INTEGER NOT NULL DEFAULT 0,
    "hitRate" DOUBLE PRECISION,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rag_query_logs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "departmentId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "users_departmentId_idx" ON "users"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "rag_synonyms_term_language_category_key" ON "rag_synonyms"("term", "language", "category");

-- CreateIndex
CREATE INDEX "rag_synonyms_enabled_category_idx" ON "rag_synonyms"("enabled", "category");

-- CreateIndex
CREATE INDEX "rag_query_logs_userId_createdAt_idx" ON "rag_query_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "rag_query_logs_conversationId_idx" ON "rag_query_logs"("conversationId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
