-- CreateTable
CREATE TABLE "agents" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatar" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "defaultModel" TEXT,
    "defaultKnowledgeScope" TEXT,
    "roleAccess" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_skills" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'core',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "reserved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_skill_bindings" (
    "agentId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "config" JSONB,

    CONSTRAINT "agent_skill_bindings_pkey" PRIMARY KEY ("agentId","skillId")
);

-- CreateTable
CREATE TABLE "agent_memories" (
    "id" SERIAL NOT NULL,
    "agentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "conversationId" INTEGER,
    "kind" TEXT NOT NULL DEFAULT 'note',
    "key" TEXT,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_run_logs" (
    "id" SERIAL NOT NULL,
    "agentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "skillCode" TEXT,
    "inputSummary" TEXT,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_run_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_code_key" ON "agents"("code");
CREATE INDEX "agents_enabled_status_idx" ON "agents"("enabled", "status");
CREATE INDEX "agents_sortOrder_idx" ON "agents"("sortOrder");
CREATE UNIQUE INDEX "agent_skills_code_key" ON "agent_skills"("code");
CREATE INDEX "agent_memories_agentId_userId_createdAt_idx" ON "agent_memories"("agentId", "userId", "createdAt");
CREATE INDEX "agent_memories_conversationId_idx" ON "agent_memories"("conversationId");
CREATE INDEX "agent_run_logs_agentId_createdAt_idx" ON "agent_run_logs"("agentId", "createdAt");
CREATE INDEX "agent_run_logs_userId_createdAt_idx" ON "agent_run_logs"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "agent_skill_bindings" ADD CONSTRAINT "agent_skill_bindings_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_skill_bindings" ADD CONSTRAINT "agent_skill_bindings_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "agent_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_run_logs" ADD CONSTRAINT "agent_run_logs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
