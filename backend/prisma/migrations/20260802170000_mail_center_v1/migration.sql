-- Mail Center V1.0
CREATE TABLE IF NOT EXISTS "mail_templates" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "variables" TEXT NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mail_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mail_templates_type_locale_key" ON "mail_templates"("type", "locale");
CREATE INDEX IF NOT EXISTS "mail_templates_type_enabled_idx" ON "mail_templates"("type", "enabled");

CREATE TABLE IF NOT EXISTS "mail_send_logs" (
    "id" SERIAL NOT NULL,
    "toMasked" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'smtp',
    "messageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "userId" INTEGER,
    "requestIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "mail_send_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "mail_send_logs_createdAt_idx" ON "mail_send_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "mail_send_logs_templateType_status_idx" ON "mail_send_logs"("templateType", "status");
CREATE INDEX IF NOT EXISTS "mail_send_logs_userId_idx" ON "mail_send_logs"("userId");
