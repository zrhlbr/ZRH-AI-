-- Phase 0.5 Security Foundation (additive only)
-- 1) dev_diff_files: SHA-256 integrity + per-file lifecycle
-- 2) dev_snapshots: pre-apply snapshots for transactional apply / rollback
-- 3) dev_audit_logs: userAgent + structured meta (redacted)

ALTER TABLE "dev_diff_files" ADD COLUMN IF NOT EXISTS "baseSha" TEXT;
ALTER TABLE "dev_diff_files" ADD COLUMN IF NOT EXISTS "afterSha" TEXT;
ALTER TABLE "dev_diff_files" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS "dev_snapshots" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "diffId" INTEGER,
    "path" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "existed" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dev_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "dev_snapshots_workspaceId_diffId_idx" ON "dev_snapshots"("workspaceId", "diffId");

ALTER TABLE "dev_audit_logs" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE "dev_audit_logs" ADD COLUMN IF NOT EXISTS "meta" JSONB;
