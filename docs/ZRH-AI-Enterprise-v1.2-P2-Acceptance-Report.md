# ZRH AI Enterprise V1.2 P2 — Implementation Acceptance Report

**Branch:** `test/v1.2`  
**Date:** 2026-08-02  
**Production:** Not deployed · Tag `v1.2.0` deferred  

## Delivered

| Area | Status |
|------|--------|
| Architecture doc | `docs/ZRH-AI-Enterprise-v1.2-P2-Developer-Agent-Architecture.md` |
| DB `dev_*` migration | `backend/prisma/migrations/20260802020000_v12_p2_developer_agent/` |
| DeveloperModule APIs | `/api/v1/developer/*` |
| Dev Runner container | `dev-runner/` + `docker-compose.test.yml` |
| Plan / Diff / delete confirm | Implemented (AI Gateway patch materialization + heuristic fallback) |
| Terminal + Git gates | Whitelist + dangerous confirmation |
| MCP Gateway invoke | filesystem/git via runner; docker/postgres/github mediated |
| Frontend `/developer` | Workbench UI + i18n zh/my/en + dangerous-git confirm + reject Diff |
| Optional Cursor Cloud provider | Official API adapter when `CURSOR_CLOUD_ENABLED=true`; **disabled by default** |
| Semantic search | Embedding cosine when Ollama embed available; lexical fallback otherwise |
| V1.1 business modules | Not modified (Chat/RAG/Knowledge/Workflow/Business) |

## Gap closures in this pass

1. Seeded MCP `git` (+ enabled filesystem/git/docker/postgresql/github for Gateway)
2. Docker MCP → `SystemService.docker()`; PostgreSQL → read-only `information_schema`; GitHub → REST when `GITHUB_TOKEN` set
3. Code index embeds chunks via `OllamaEmbeddingProvider`; semantic search uses cosine similarity
4. Plan approve → Diff uses AI Gateway full-file generation (fallback TODO/heuristic)
5. UI: reject Diff, dangerous Git second confirm, optional git remote on create workspace
6. Cursor Cloud provider: real HTTP adapter behind env flags (still off by default)

## Local verify

```bash
# API / Frontend typecheck
cd backend && npx prisma generate && npx tsc --noEmit -p tsconfig.build.json
cd frontend && npx tsc --noEmit -p tsconfig.json

# Test stack rebuild
docker compose -p zrh-ai-test -f docker-compose.test.yml --env-file .env.test up -d --build

# Reseed MCP (inside API container; DATABASE_URL from POSTGRES_*)
docker exec zrh-ai-test-api sh -c 'export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public"; node prisma/seed.js'

# Smoke
node _mail_isolation/p2_accept_smoke.mjs
```

## Acceptance checklist (test stack 2026-08-02)

- [x] migrate + seed on test DB (`mcp servers: 11`, includes `git`)
- [x] Runner health ok from `/developer/health`
- [x] Create workspace, tree, read file, `.env` blocked (403)
- [x] Index + file/symbol/ref/semantic search (semantic mode may be `lexical-fallback` if embed model cold)
- [x] Terminal whitelist; force push / hard reset denied without confirm (403)
- [x] MCP invoke filesystem/git/docker/postgresql via gateway
- [x] `/developer` UI panels + three languages (i18n keys updated)
- [x] Cursor cloud remains off; local coder path works
- [x] V1.1 Chat/Knowledge/RAG/Agent/Workflow unauth smoke OK (401)
- [x] Production images not upgraded by this pass; **no production deploy**

### Smoke score

`passed=27 failed=0` (after resolving optional profile endpoint; MCP userId JWT-injected)

## Gates remaining (product decision — not coding)

Decide after 赵总 review:

1. Git Tag `v1.2.0`
2. Production Release

**P2 implementation acceptance: READY on test line.**  
**Production impact: 0** (no prod deploy in this task).
