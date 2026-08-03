-- Stabilization Round 2: Knowledge / RAG query indexes
CREATE INDEX IF NOT EXISTS "knowledge_document_versions_storagePath_idx"
  ON "knowledge_document_versions"("storagePath");

CREATE INDEX IF NOT EXISTS "knowledge_document_versions_hash_idx"
  ON "knowledge_document_versions"("hash");

CREATE INDEX IF NOT EXISTS "knowledge_chunks_documentId_language_idx"
  ON "knowledge_chunks"("documentId", "language");

CREATE INDEX IF NOT EXISTS "document_permissions_targetType_targetId_idx"
  ON "document_permissions"("targetType", "targetId");
