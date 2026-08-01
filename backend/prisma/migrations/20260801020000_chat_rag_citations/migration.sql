-- Chat ↔ Enterprise RAG：消息级 citation / 命中标记
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ragHit" BOOLEAN;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "citations" JSONB;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "rewrittenQuery" TEXT;
