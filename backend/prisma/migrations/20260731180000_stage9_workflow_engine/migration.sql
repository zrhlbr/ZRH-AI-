-- CreateTable
CREATE TABLE "workflow_categories" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workflow_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_definitions" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" INTEGER NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "template" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "graph" JSONB NOT NULL,
    "variables" JSONB,
    "roleAccess" TEXT,
    "timeoutMs" INTEGER NOT NULL DEFAULT 120000,
    "maxRetries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_runs" (
    "id" SERIAL NOT NULL,
    "workflowId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "mode" TEXT NOT NULL DEFAULT 'sync',
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "input" JSONB,
    "output" JSONB,
    "variables" JSONB,
    "error" TEXT,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_node_runs" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_node_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_schedules" (
    "id" SERIAL NOT NULL,
    "workflowId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "kind" TEXT NOT NULL DEFAULT 'cron',
    "cronExpr" TEXT,
    "intervalSec" INTEGER,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workflow_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_audit_logs" (
    "id" SERIAL NOT NULL,
    "workflowId" INTEGER NOT NULL,
    "runId" INTEGER,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workflow_categories_code_key" ON "workflow_categories"("code");
CREATE UNIQUE INDEX "workflow_definitions_code_key" ON "workflow_definitions"("code");
CREATE INDEX "workflow_definitions_enabled_status_idx" ON "workflow_definitions"("enabled", "status");
CREATE INDEX "workflow_definitions_categoryId_idx" ON "workflow_definitions"("categoryId");
CREATE INDEX "workflow_definitions_template_idx" ON "workflow_definitions"("template");
CREATE INDEX "workflow_runs_workflowId_createdAt_idx" ON "workflow_runs"("workflowId", "createdAt");
CREATE INDEX "workflow_runs_userId_createdAt_idx" ON "workflow_runs"("userId", "createdAt");
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs"("status");
CREATE INDEX "workflow_node_runs_runId_createdAt_idx" ON "workflow_node_runs"("runId", "createdAt");
CREATE INDEX "workflow_schedules_enabled_nextRunAt_idx" ON "workflow_schedules"("enabled", "nextRunAt");
CREATE INDEX "workflow_schedules_workflowId_idx" ON "workflow_schedules"("workflowId");
CREATE INDEX "workflow_audit_logs_workflowId_createdAt_idx" ON "workflow_audit_logs"("workflowId", "createdAt");
CREATE INDEX "workflow_audit_logs_runId_idx" ON "workflow_audit_logs"("runId");

ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "workflow_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_node_runs" ADD CONSTRAINT "workflow_node_runs_runId_fkey" FOREIGN KEY ("runId") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_schedules" ADD CONSTRAINT "workflow_schedules_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_audit_logs" ADD CONSTRAINT "workflow_audit_logs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_audit_logs" ADD CONSTRAINT "workflow_audit_logs_runId_fkey" FOREIGN KEY ("runId") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
