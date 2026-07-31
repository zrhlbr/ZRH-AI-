CREATE TABLE "companies" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_systems" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'online',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "readOnlyDefault" BOOLEAN NOT NULL DEFAULT true,
    "writeRequiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "roleAccess" TEXT,
    "companyCode" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "business_systems_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_connectors" (
    "id" SERIAL NOT NULL,
    "systemId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "transport" TEXT NOT NULL DEFAULT 'stub',
    "endpoint" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "healthStatus" TEXT NOT NULL DEFAULT 'unknown',
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "business_connectors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_system_workflows" (
    "id" SERIAL NOT NULL,
    "systemId" INTEGER NOT NULL,
    "actionCode" TEXT NOT NULL,
    "workflowCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "readOnly" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "business_system_workflows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_audit_logs" (
    "id" SERIAL NOT NULL,
    "systemId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "workflowCode" TEXT,
    "workflowRunId" INTEGER,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "departmentId" INTEGER,
    "companyCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "business_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");
CREATE UNIQUE INDEX "business_systems_code_key" ON "business_systems"("code");
CREATE INDEX "business_systems_enabled_status_idx" ON "business_systems"("enabled", "status");
CREATE INDEX "business_systems_kind_idx" ON "business_systems"("kind");
CREATE UNIQUE INDEX "business_connectors_systemId_code_key" ON "business_connectors"("systemId", "code");
CREATE INDEX "business_connectors_enabled_status_idx" ON "business_connectors"("enabled", "status");
CREATE UNIQUE INDEX "business_system_workflows_systemId_actionCode_key" ON "business_system_workflows"("systemId", "actionCode");
CREATE INDEX "business_system_workflows_workflowCode_idx" ON "business_system_workflows"("workflowCode");
CREATE INDEX "business_audit_logs_systemId_createdAt_idx" ON "business_audit_logs"("systemId", "createdAt");
CREATE INDEX "business_audit_logs_userId_createdAt_idx" ON "business_audit_logs"("userId", "createdAt");

ALTER TABLE "business_connectors" ADD CONSTRAINT "business_connectors_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "business_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_system_workflows" ADD CONSTRAINT "business_system_workflows_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "business_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_audit_logs" ADD CONSTRAINT "business_audit_logs_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "business_systems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
