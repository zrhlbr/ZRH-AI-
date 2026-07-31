-- CreateTable
CREATE TABLE "tool_categories" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tool_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tool_definitions" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" INTEGER NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "inputSchema" JSONB,
    "outputSchema" JSONB,
    "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "maxRetries" INTEGER NOT NULL DEFAULT 1,
    "roleAccess" TEXT,
    "executorCode" TEXT NOT NULL,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tool_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tool_run_logs" (
    "id" SERIAL NOT NULL,
    "toolId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "agentCode" TEXT,
    "status" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tool_run_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mcp_servers" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "transport" TEXT NOT NULL DEFAULT 'stub',
    "endpoint" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "version" TEXT NOT NULL DEFAULT '0.1.0',
    "builtin" BOOLEAN NOT NULL DEFAULT true,
    "reserved" BOOLEAN NOT NULL DEFAULT true,
    "roleAccess" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mcp_servers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mcp_sessions" (
    "id" SERIAL NOT NULL,
    "serverId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "mcp_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mcp_run_logs" (
    "id" SERIAL NOT NULL,
    "serverId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_run_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tool_categories_code_key" ON "tool_categories"("code");
CREATE UNIQUE INDEX "tool_definitions_code_key" ON "tool_definitions"("code");
CREATE INDEX "tool_definitions_enabled_idx" ON "tool_definitions"("enabled");
CREATE INDEX "tool_definitions_categoryId_idx" ON "tool_definitions"("categoryId");
CREATE INDEX "tool_run_logs_toolId_createdAt_idx" ON "tool_run_logs"("toolId", "createdAt");
CREATE INDEX "tool_run_logs_userId_createdAt_idx" ON "tool_run_logs"("userId", "createdAt");
CREATE UNIQUE INDEX "mcp_servers_code_key" ON "mcp_servers"("code");
CREATE INDEX "mcp_servers_enabled_status_idx" ON "mcp_servers"("enabled", "status");
CREATE INDEX "mcp_sessions_serverId_userId_idx" ON "mcp_sessions"("serverId", "userId");
CREATE INDEX "mcp_run_logs_serverId_createdAt_idx" ON "mcp_run_logs"("serverId", "createdAt");

ALTER TABLE "tool_definitions" ADD CONSTRAINT "tool_definitions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "tool_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tool_run_logs" ADD CONSTRAINT "tool_run_logs_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "tool_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_sessions" ADD CONSTRAINT "mcp_sessions_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mcp_run_logs" ADD CONSTRAINT "mcp_run_logs_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
