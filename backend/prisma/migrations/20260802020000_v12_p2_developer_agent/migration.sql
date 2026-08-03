-- V1.2 P2 Developer Agent (additive only)

CREATE TABLE IF NOT EXISTS "dev_workspaces" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'bind',
    "rootPath" TEXT NOT NULL,
    "description" TEXT,
    "ownerUserId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "defaultBranch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dev_workspaces_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "dev_workspaces_slug_key" ON "dev_workspaces"("slug");
CREATE INDEX IF NOT EXISTS "dev_workspaces_ownerUserId_idx" ON "dev_workspaces"("ownerUserId");
CREATE INDEX IF NOT EXISTS "dev_workspaces_status_idx" ON "dev_workspaces"("status");

CREATE TABLE IF NOT EXISTS "dev_workspace_members" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dev_workspace_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "dev_workspace_members_workspaceId_userId_key" ON "dev_workspace_members"("workspaceId", "userId");
CREATE INDEX IF NOT EXISTS "dev_workspace_members_userId_idx" ON "dev_workspace_members"("userId");

CREATE TABLE IF NOT EXISTS "dev_workspace_repos" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "remoteUrl" TEXT,
    "currentBranch" TEXT,
    "lastFetchAt" TIMESTAMP(3),
    "headSha" TEXT,
    "dirty" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dev_workspace_repos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "dev_workspace_repos_workspaceId_key" ON "dev_workspace_repos"("workspaceId");

CREATE TABLE IF NOT EXISTS "dev_sessions" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT,
    "skillCode" TEXT NOT NULL DEFAULT 'feature',
    "modelAlias" TEXT,
    "modelRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dev_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "dev_sessions_workspaceId_userId_idx" ON "dev_sessions"("workspaceId", "userId");

CREATE TABLE IF NOT EXISTS "dev_session_messages" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dev_session_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "dev_session_messages_sessionId_createdAt_idx" ON "dev_session_messages"("sessionId", "createdAt");

CREATE TABLE IF NOT EXISTS "dev_plans" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "sessionId" INTEGER,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "riskLevel" TEXT NOT NULL DEFAULT 'medium',
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dev_plans_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "dev_plans_workspaceId_status_idx" ON "dev_plans"("workspaceId", "status");

CREATE TABLE IF NOT EXISTS "dev_plan_steps" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "ord" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "path" TEXT,
    "detail" TEXT,
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "approvalState" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dev_plan_steps_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "dev_plan_steps_planId_ord_idx" ON "dev_plan_steps"("planId", "ord");

CREATE TABLE IF NOT EXISTS "dev_diffs" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "planId" INTEGER,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "unifiedSummary" TEXT,
    "approvedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dev_diffs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "dev_diffs_workspaceId_status_idx" ON "dev_diffs"("workspaceId", "status");

CREATE TABLE IF NOT EXISTS "dev_diff_files" (
    "id" SERIAL NOT NULL,
    "diffId" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "patch" TEXT NOT NULL,
    "deleteConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dev_diff_files_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "dev_diff_files_diffId_idx" ON "dev_diff_files"("diffId");

CREATE TABLE IF NOT EXISTS "dev_terminal_runs" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "command" TEXT NOT NULL,
    "cwd" TEXT,
    "exitCode" INTEGER,
    "timedOut" BOOLEAN NOT NULL DEFAULT false,
    "stdoutSummary" TEXT,
    "stderrSummary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dev_terminal_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "dev_terminal_runs_workspaceId_createdAt_idx" ON "dev_terminal_runs"("workspaceId", "createdAt");

CREATE TABLE IF NOT EXISTS "dev_git_ops" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "op" TEXT NOT NULL,
    "args" TEXT,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dev_git_ops_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "dev_git_ops_workspaceId_createdAt_idx" ON "dev_git_ops"("workspaceId", "createdAt");

CREATE TABLE IF NOT EXISTS "dev_code_files" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "language" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "mtimeMs" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dev_code_files_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "dev_code_files_workspaceId_path_key" ON "dev_code_files"("workspaceId", "path");
CREATE INDEX IF NOT EXISTS "dev_code_files_workspaceId_idx" ON "dev_code_files"("workspaceId");

CREATE TABLE IF NOT EXISTS "dev_code_symbols" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "lineStart" INTEGER NOT NULL DEFAULT 1,
    "lineEnd" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dev_code_symbols_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "dev_code_symbols_workspaceId_name_idx" ON "dev_code_symbols"("workspaceId", "name");
CREATE INDEX IF NOT EXISTS "dev_code_symbols_workspaceId_path_idx" ON "dev_code_symbols"("workspaceId", "path");

CREATE TABLE IF NOT EXISTS "dev_code_vectors" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "embedding" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dev_code_vectors_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "dev_code_vectors_workspaceId_path_idx" ON "dev_code_vectors"("workspaceId", "path");

CREATE TABLE IF NOT EXISTS "dev_audit_logs" (
    "id" SERIAL NOT NULL,
    "workspaceId" INTEGER,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "result" TEXT NOT NULL,
    "detail" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dev_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "dev_audit_logs_workspaceId_createdAt_idx" ON "dev_audit_logs"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "dev_audit_logs_userId_createdAt_idx" ON "dev_audit_logs"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "dev_skills" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "promptHint" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dev_skills_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "dev_skills_code_key" ON "dev_skills"("code");

CREATE TABLE IF NOT EXISTS "dev_provider_settings" (
    "id" SERIAL NOT NULL,
    "providerCode" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "configJson" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dev_provider_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "dev_provider_settings_providerCode_key" ON "dev_provider_settings"("providerCode");

DO $$ BEGIN ALTER TABLE "dev_workspace_members" ADD CONSTRAINT "dev_workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "dev_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "dev_workspace_repos" ADD CONSTRAINT "dev_workspace_repos_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "dev_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "dev_sessions" ADD CONSTRAINT "dev_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "dev_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "dev_session_messages" ADD CONSTRAINT "dev_session_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "dev_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "dev_plans" ADD CONSTRAINT "dev_plans_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "dev_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "dev_plans" ADD CONSTRAINT "dev_plans_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "dev_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "dev_plan_steps" ADD CONSTRAINT "dev_plan_steps_planId_fkey" FOREIGN KEY ("planId") REFERENCES "dev_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "dev_diffs" ADD CONSTRAINT "dev_diffs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "dev_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "dev_diffs" ADD CONSTRAINT "dev_diffs_planId_fkey" FOREIGN KEY ("planId") REFERENCES "dev_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "dev_diff_files" ADD CONSTRAINT "dev_diff_files_diffId_fkey" FOREIGN KEY ("diffId") REFERENCES "dev_diffs"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "dev_terminal_runs" ADD CONSTRAINT "dev_terminal_runs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "dev_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "dev_git_ops" ADD CONSTRAINT "dev_git_ops_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "dev_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "dev_code_files" ADD CONSTRAINT "dev_code_files_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "dev_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "dev_code_symbols" ADD CONSTRAINT "dev_code_symbols_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "dev_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "dev_code_vectors" ADD CONSTRAINT "dev_code_vectors_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "dev_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "dev_audit_logs" ADD CONSTRAINT "dev_audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "dev_workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
