# ZRHLBR Hybrid Inference V1.0 — Production Deployment Report

**Date:** 2026-08-08  
**Status:** **PRODUCTION_STATUS=READY**  
**Branch:** `test/v1.2`  
**Feature baseline:** `056db80` / `6102085` / `83e431e`  
**Production images:** `zrh-ai-api:1.2.5` · `zrh-ai-web:1.2.5`  
**Previous images (rollback):** `zrh-ai-api:1.2.4` · `zrh-ai-web:1.2.4`  
**main / Release Tag:** **not** created (await 赵总)

---

## Scorecard

| Key | Result |
|-----|--------|
| **DEPLOYMENT** | **PASS** |
| **GPU_PRODUCTION** | **PASS** |
| **CPU_FALLBACK_PRODUCTION** | **PASS** |
| **AUTO_RECOVERY_PRODUCTION** | **PASS** |
| **PUBLIC_11434_BLOCKED** | **PASS** |
| **USER_INFO_LEAK** | **PASS** |
| **BUSINESS_REGRESSION** | **PASS** |
| **ROLLBACK_READY** | **YES** |
| **PRODUCTION_STATUS** | **READY** |

### Production acceptance P1–P9

| ID | Case | Result |
|----|------|--------|
| P1 | Laptop Online → RTX 5060 | **PASS** (`preferred=laptop-gpu`, HEALTHY) |
| P2 | Stop laptop path → CPU | **PASS** (`cpu-fallback-ok`) |
| P3 | Recover → GPU | **PASS** (HEALTHY → preferred laptop-gpu) |
| P4 | GPU+CPU status | **PASS** (both HEALTHY / CLOSED after restore) |
| P5 | Real Chat | **PASS** (done ~7.2s, GPU path) |
| P6 | Real Coder | **PASS** (TS hello deltas; ~37.8 tok/s; `100% GPU`) |
| P7 | SUPER_ADMIN AI Infrastructure | **PASS** (`/superadmin/ai/inference`) |
| P8 | USER no internal IPs | **PASS** (`/ai/providers` clean) |
| P9 | Public 11434 blocked | **PASS** (server public iface HTTP 000; CPU bind `127.0.0.1` only) |

---

## Pre-Deployment Backup

**Location:** `/home/zrh-admin/backups/hybrid-v1.0-predeploy-20260808-185319`

Contains:
- `.env.backup` (mode 600)
- `docker-compose.config.yml` / `docker-compose.production.yml`
- `postgres.dump` (~296KB)
- `containers.txt` / `images.txt` / `api-health.json`
- `ROLLBACK.md`
- `deploy-whitelist.txt`

### Rollback (quick)

```bash
cd /home/zrh-admin/zrh-ai
# 1) Prefer disable Hybrid only
sed -i 's/^HYBRID_INFERENCE_ENABLED=.*/HYBRID_INFERENCE_ENABLED=false/' .env
docker compose -f docker-compose.production.yml --env-file .env up -d --no-deps zrh-ai-api

# 2) Full image rollback to 1.2.4 if needed
# restore .env from backup if required:
#   cp /home/zrh-admin/backups/hybrid-v1.0-predeploy-20260808-185319/.env.backup .env
# set ZRH_AI_IMAGE_TAG=1.2.4 then:
#   docker compose -f docker-compose.production.yml --env-file .env up -d --no-deps zrh-ai-api zrh-ai-web
# NEVER delete postgres/redis volumes
```

---

## Deployment Steps Executed

1. **Backup** completed (above).
2. **Whitelist sync** of Hybrid commits only (no unrelated dirty tree).
3. **CPU node:** `zrh-ai-test-ollama-cpu` connected to `zrh-ai-network`; listen **`127.0.0.1:11434` only**.
4. **Phase 1:** images `1.2.5`, `HYBRID_INFERENCE_ENABLED=false`, recreate **api/web only**.
5. **Phase 1 regression:** API/Web/Public/Login/Chat/Leak — **PASS**; postgres/redis **6 days up** (untouched).
6. **Phase 2:** `HYBRID_INFERENCE_ENABLED=true`, restart **api only**.
7. **P1–P9** — **PASS**.

### Production env (non-secret)

```
ZRH_AI_IMAGE_TAG=1.2.5
HYBRID_INFERENCE_ENABLED=true
HYBRID_ROUTING_MODE=AUTO
LAPTOP_OLLAMA_BASE_URL=http://100.105.217.7:11434
SERVER_OLLAMA_BASE_URL=http://zrh-ai-test-ollama-cpu:11434
OLLAMA_BASE_URL=http://100.105.217.7:11434
```

Secrets / SMTP / JWT: **not overwritten** (keys retained from prior `.env`).

---

## GPU / CPU Evidence (Production)

| Node | Evidence |
|------|----------|
| Laptop RTX 5060 | Tailscale `100.105.217.7`; generate `prod-gpu` ~**59.5 tok/s**; `ollama ps` **100% GPU**; coder chat **~37.8 tok/s** |
| Server CPU | In-network `zrh-ai-test-ollama-cpu`; failover body `cpu-fallback-ok`; public iface **not** listening |
| Firewall | Laptop rule still only `100.83.172.96 → 11434` (not widened) |

---

## Container Status (post-cutover)

| Name | Image | Notes |
|------|-------|-------|
| zrh-ai-api | `1.2.5` | healthy, Hybrid ON |
| zrh-ai-web | `1.2.5` | healthy |
| zrh-ai-postgres | postgres:16-alpine | **6 days** healthy — volume intact |
| zrh-ai-redis | redis:7-alpine | **6 days** healthy — volume intact |
| zrh-ai-test-ollama-cpu | ollama/ollama | CPU fallback (127.0.0.1:11434) |

Public: `https://ai.zrhtech.com/` → **200**

---

## Observation Notes

- Strategy: `GPU_FIRST_WITH_CPU_FAILOVER`
- Circuit breaker fields live on SUPER_ADMIN snap
- SSE unavailable path returns explicit `AI_SERVICE_UNAVAILABLE` (no fake success)
- Prefer watching: API 5xx, provider flap, SSE errors, GPU/CPU latency, docker/pg/redis health

---

## Git / Push

- Local commits include Hybrid feature + test acceptance + this production report.
- **Push `test/v1.2`:** **DONE** → `8edfaec..ee349ce` on `origin/test/v1.2`
- Tip SHA: `ee349ceafd936c251c2224c82d40a0423a862c66`
- **Forbidden (not done):** force push, history rewrite, merge `main`, Release Tag.

---

## Final

**DEPLOYMENT=PASS**  
**PRODUCTION_STATUS=READY**  
**Await 赵总 for:** merge `main` / Release Tag (if desired).
