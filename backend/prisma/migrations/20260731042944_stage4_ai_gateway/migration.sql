-- CreateTable
CREATE TABLE "ai_providers" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "sizeBytes" BIGINT,
    "digest" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "contextLength" INTEGER NOT NULL DEFAULT 8192,
    "params" JSONB,
    "pulledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_capabilities" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "model_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_model_capabilities" (
    "modelId" INTEGER NOT NULL,
    "capabilityId" INTEGER NOT NULL,

    CONSTRAINT "ai_model_capabilities_pkey" PRIMARY KEY ("modelId","capabilityId")
);

-- CreateTable
CREATE TABLE "model_health" (
    "id" SERIAL NOT NULL,
    "modelId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_health_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_providers_code_key" ON "ai_providers"("code");

-- CreateIndex
CREATE INDEX "ai_models_providerCode_idx" ON "ai_models"("providerCode");

-- CreateIndex
CREATE INDEX "ai_models_enabled_idx" ON "ai_models"("enabled");

-- CreateIndex
CREATE INDEX "ai_models_status_idx" ON "ai_models"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_models_providerCode_name_key" ON "ai_models"("providerCode", "name");

-- CreateIndex
CREATE UNIQUE INDEX "model_capabilities_code_key" ON "model_capabilities"("code");

-- CreateIndex
CREATE INDEX "model_health_modelId_checkedAt_idx" ON "model_health"("modelId", "checkedAt");

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_providerCode_fkey" FOREIGN KEY ("providerCode") REFERENCES "ai_providers"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_model_capabilities" ADD CONSTRAINT "ai_model_capabilities_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ai_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_model_capabilities" ADD CONSTRAINT "ai_model_capabilities_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "model_capabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_health" ADD CONSTRAINT "model_health_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ai_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
