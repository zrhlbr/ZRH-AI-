# ZRH AI Enterprise V1.2 — Independent Test Version

**Status:** Test line created — **not production**  
**Date:** 2026-08-02  
**Baseline production:** v1.1.0 @ `5244b4f` (images `zrh-ai-api:1.1.0` / `zrh-ai-web:1.1.0`)

---

## Purpose

Isolate V1.2 P1 (User Center / Admin / Super Admin) for full test-environment acceptance **without** changing V1.1 Production.

---

## Git

| Item | Value |
|------|--------|
| Branch | `test/v1.2` |
| Test tag | `v1.2.0-test` |
| Production tag | **not created** (`v1.2.0` deferred) |
| `main` | Remains on V1.1 line until release decision |

---

## Images (test only)

| Image | Tag |
|-------|-----|
| `zrh-ai-api` | `1.2.0-test` |
| `zrh-ai-web` | `1.2.0-test` |

Production compose defaults stay `1.1.0`. Do not retag or redeploy production.

---

## How to run test stack (separate project)

```bash
cp .env.test.example .env.test
# edit secrets / WEB_ORIGIN / OLLAMA_BASE_URL

docker compose -p zrh-ai-test \
  -f docker-compose.production.yml \
  --env-file .env.test \
  up -d --build

# migrate + seed inside API container after healthy
docker compose -p zrh-ai-test -f docker-compose.production.yml --env-file .env.test \
  exec zrh-ai-api npx prisma migrate deploy
docker compose -p zrh-ai-test -f docker-compose.production.yml --env-file .env.test \
  exec zrh-ai-api npx prisma db seed
```

- Project `-p zrh-ai-test` → separate volumes from production `zrh-ai`
- Ports default **3011 / 4011** (see `.env.test.example`)
- Production bind **3010 / 4010** untouched

---

## Unchanged V1.1 modules

AI Gateway · Enterprise RAG · Knowledge · Workflow · Agent · MCP · Business Hub · Chat — no intentional business changes in this line.

---

## Next gates (manual)

1. Complete test-environment acceptance  
2. Then decide: Git Tag `v1.2.0`  
3. Then decide: Production Release  

**No automatic production deploy. No next development phase.**
