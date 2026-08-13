# ZRHLBR AI V1.0 — Final Production Acceptance Report

**Date:** 2026-08-13  
**Phase:** ZRHLBR AI FINAL PRODUCTION COMPLETION  
**Git branch (freeze):** `test/v1.2`  
**Git SHA (pre-freeze tip):** `d1e57c0ad6e03e63b1e6283de6f8c10fe6b326ca`  
**Public:** `https://ai.zrhtech.com`  
**Verdict:** core gates **PASS** · **P0_OPEN=0** · **ROLLBACK_READY=YES**

---

## 1. Actual production state (measured, not guessed)

Recorded on SA5212M5 (`zrh-admin@100.83.172.96`) at verification time.

| Key | Value |
|-----|--------|
| CURRENT_BRANCH (workspace freeze) | `test/v1.2` |
| CURRENT_COMMIT | `d1e57c0ad6e03e63b1e6283de6f8c10fe6b326ca` |
| PROD_API_IMAGE | `zrh-ai-api:candidate-abort-b042c11` (also tagged `pre-rtx4090-20260813-121958`) |
| PROD_WEB_IMAGE | `zrh-ai-web:1.2.5` |
| PROD_API_IMAGE_SHA | `sha256:7926c03919a8ef4034552cf25452b27881d870e682821bb00983464309bb3cdd` |
| PROD_WEB_IMAGE_SHA | `sha256:a31b70a461d8f634eda89e4cec01524c33aa53133f24e6e212b2b71ffac52ad9` |
| API 1.2.5 image (present, not currently running) | `zrh-ai-api:1.2.5` / `rollback-1.2.5` · `sha256:2489bfde2c5ec977724f9719797847db6e11880c6cded1dcc6239c5dbcecf753` |
| WEB 1.2.5 image | same as running web SHA above |

Containers (all `restart=0`, `oom=false`, Docker health **healthy**):

| Name | Image | Notes |
|------|--------|--------|
| zrh-ai-api | `candidate-abort-b042c11` | healthy · Hybrid ON · not attached to compose labels |
| zrh-ai-web | `zrh-ai-web:1.2.5` | healthy · `127.0.0.1:3010` |
| zrh-ai-postgres | `postgres:16-alpine` | healthy |
| zrh-ai-redis | `redis:7-alpine` | healthy |

**Lineage:** running API image is a **descendant** of `test/v1.2` (`d1e57c0`) plus later commits (`accounts service-auth`, A1 dual-host, abort seal `b042c11`). V1.0 git freeze tags Hybrid Inference V1.0 on `test/v1.2`; it does **not** rewrite the running abort-candidate container.

---

## 2. Production Health Final Gate

| Key | Result | Evidence |
|-----|--------|----------|
| API_HEALTH | **PASS** | `GET /api/v1/health` → `database=online` `redis=online`; after GPU restore `status=ok` `ollama=online`. Container health=healthy. |
| WEB_HEALTH | **PASS** | `http://127.0.0.1:3010/` HTTP **200** |
| POSTGRES_HEALTH | **PASS** | `pg_isready` accepting connections; container healthy |
| REDIS_HEALTH | **PASS** | container health=healthy; restart=0 |
| PRODUCTION_ERRORS | **PASS** | 24h API logs: panic/fatal/unhandled-rejection count **0**. No OOM. Restart count **0**. |

Note: while laptop-local Ollama was stopped, legacy health field `ollama=offline` / `status=degraded` appeared. Hybrid GPU node (configured `other_ip`, not this laptop’s Tailscale IP) remained usable. After restore: `status=ok`.

---

## 3. Hybrid Inference Final Gate

Strategy: `GPU_FIRST_WITH_CPU_FAILOVER` · `routingMode=AUTO` · `enabled=true`.

### A. GPU priority — **PASS**

- Snapshot: `currentPreferred=laptop-gpu`, node **HEALTHY**, circuit **CLOSED**, latency 17ms.
- Chat SSE: `Reply with exactly: gpu-final-ok` → preview `gpu-final-ok`, `done=true`, leaked=false.
- Log: `gateway stream hybrid node=laptop-gpu provider=laptop-gpu model=qwen3:8b conv=16`.

### B. CPU failover — **PASS**

Safe existing method: `POST /superadmin/ai/inference/node` `{nodeId:laptop-gpu, enabled:false}` (same router method as `scripts/hybrid-test-e2e.py`; no Docker stop of CPU Ollama).

- Snapshot after disable: `currentPreferred=server-cpu`, laptop-gpu **DISABLED**.
- Chat SSE: `cpu-node-ok`, HTTP 200, leaked=false, errors=[].
- Log: `gateway stream hybrid node=server-cpu provider=server-cpu model=qwen3:8b conv=21`.
- API remained healthy, restart=0, no crash, no internal IP/SSH/Ollama leak in SSE.

Laptop process-stop (`hybrid-laptop-ollama-ctl.ps1 stop`) did **not** take the hybrid GPU node offline, because `laptopOllamaBaseUrl` is **not** `100.105.217.7` (`laptop_kind=other_ip`). That config drift is a P1, not a functional failover fail.

### C. GPU auto-recovery — **PASS**

- Re-enable node → health **RECOVERING** then log `hybrid node laptop-gpu recovered → HEALTHY`.
- Snapshot: `currentPreferred=laptop-gpu`, HEALTHY, circuit CLOSED.
- Chat SSE: `gpu-recovered-ok`, HTTP 200, leaked=false.
- Log: `gateway stream hybrid node=laptop-gpu ... conv=22`.
- Laptop Ollama started again via existing ctl script. Health `status=ok`. **No leftover disable.**

| Key | Result |
|-----|--------|
| GPU_PRIORITY | **PASS** |
| CPU_FAILOVER | **PASS** |
| GPU_AUTO_RECOVERY | **PASS** |

---

## 4. Streaming / Conversation Gate

| Key | Result | Evidence |
|-----|--------|----------|
| CHAT | **PASS** | SSE 200, deltas, `done`, no leak |
| SSE | **PASS** | `text/event-stream` events `meta/rag/delta/done`; no garbled reconnect storm |
| STOP | **PASS** | concurrent `POST /chat/stop` → `stopped: true`; stream aborted; leaked=false |
| CONTINUE | **PASS** | `continue=true` HTTP 200, deltas, done, leaked=false |
| REGENERATE | **PASS** | `POST /chat/regenerate` HTTP 200, deltas, done, leaked=false |
| HISTORY | **PASS** | `GET /chat/list` 200; `GET /chat/15` 200 |
| RENAME | **PASS** | PATCH title `final-prod-verify` 200 |
| SEARCH | **PASS** | `GET /chat/list?search=final-prod-verify` 200 |
| FAVORITE | **PASS** | PATCH `favorite=true` 200 |
| EXPORT | **PASS** | `GET /chat/15/export?format=md` 200 |
| MODEL_SELECTION | **PASS** | `GET /chat/models` 200 |
| THREE_LANGUAGE | **PASS** | zh preview `验收通过`; en `acceptance-ok`; my Myanmar script reply; leaked=false. i18n packs `zh-CN` / `en-US` / `my-MM` present. `PATCH /user-center/me` language `en-US` then restored `zh-CN`. Client persistence: `localStorage` key `zrh-ai-language`. |

No infinite loading, no user-visible internal IPs, no password/token/secret in SSE bodies checked.

---

## 5. Security Final Gate

| Check | Result |
|-------|--------|
| PUBLIC_11434_BLOCKED | **PASS** — public iface `100.83.172.96:11434` connection refused; listen **`127.0.0.1:11434` only** |
| AUTH | **PASS** — `GET /chat/list` no token **401**; `POST /internal/ai/chat` no service token **401** |
| RBAC | **PASS** — `/superadmin/ai/inference` requires SUPER_ADMIN; USER `/ai/providers` has no internal URLs |
| CORS | **PASS** — `Origin: https://evil.example` not reflected; `https://ai.zrhtech.com` allowed |
| RATE_LIMIT | **PASS** (AI routes) — `@RateLimit` on `/ai/chat` (20/min) and related AI admin routes. Login burst (15× bad password) stayed **400**, not 429 — see P1. |
| PROMPT/ERROR INTERNAL INFO LEAK | **PASS** — USER providers + SSE bodies: no Tailscale/LAN `:11434` / ssh / password |
| SECRET LEAK | **PASS** — no password/token/API secret/SSH/private key in checked responses or 24h error logs |

**SECURITY_GATE=PASS**

---

## 6. Production Stability Gate

| Item | Value |
|------|--------|
| API CPU / RAM | 0.31% · 210MiB |
| Web / Postgres / Redis mem | 69MiB / 28MiB / 5MiB |
| Host RAM | 9.8Gi used / 251Gi |
| Disk `/` | 227G / 3.5T (**7%**) |
| Docker images | 116.6GB total · 36.39GB reclaimable (**not cleaned**) |
| Container restart | 0 (api/web/postgres/redis) |
| OOM | false |
| Log storm | not observed |

**STABILITY_GATE=PASS** — no high-risk cleanup executed.

---

## 7. Rollback Final Verification

| Key | Value |
|-----|--------|
| ROLLBACK_API_IMAGE | `zrh-ai-api:1.2.4` · `sha256:e7b6e0d4f7e9184f4a32dfaae40a94a83225d4be6627a3e500420e49b4caf8c8` |
| ROLLBACK_WEB_IMAGE | `zrh-ai-web:1.2.4` · `sha256:c945e8e782743055429f62d4fc7b1e988485ed2b6f46b59b99320594e815b913` |
| Also retained | `zrh-ai-api:1.2.5` / `rollback-1.2.5` · `zrh-ai-web:1.2.5` / `rollback-1.2.5` |
| ROLLBACK_READY | **YES** |

No old images deleted. Backup still documented at `/home/zrh-admin/backups/hybrid-v1.0-predeploy-20260808-185319`.

---

## 8. Regression Gate (consumers — read-only)

| Consumer | Result |
|----------|--------|
| ZRH Accounts AI Adapter | **PASS** — `GET /api/ai-assistant/status` **401** Missing access token; `POST /api/ai-assistant/chat` **401**. Adapter routes mapped. No Accounts business code changed. |
| Global Commerce AI Adapter | **PASS** (isolation) — merchant `POST /api/global-commerce/ai/chat` **401**. Market `POST /api/market/ai/chat` **400** (route exists; empty body). Web 200. No GC business code changed. |
| Other ZRHLBR consumers | Internal machine route `/api/v1/internal/ai/chat` **401** without service principal. |

Authenticated end-to-end chat **through** Accounts/GC UI was not executed (would require consumer credentials / cross-module sessions). Isolation and route presence were verified.

**CONSUMER_REGRESSION=PASS**

---

## 9. Final Scorecard

| Key | Result |
|-----|--------|
| PRODUCTION_HEALTH | **PASS** |
| GPU_PRIORITY | **PASS** |
| CPU_FAILOVER | **PASS** |
| GPU_AUTO_RECOVERY | **PASS** |
| SSE | **PASS** |
| THREE_LANGUAGE | **PASS** |
| SECURITY | **PASS** |
| PUBLIC_11434_BLOCKED | **PASS** |
| AUTH_RBAC | **PASS** |
| INTERNAL_INFO_LEAK | **PASS** |
| STABILITY | **PASS** |
| ROLLBACK_READY | **YES** |
| CONSUMER_REGRESSION | **PASS** |
| P0_OPEN | **0** |
| P1_OPEN | **4** |

---

## 10. Known limitations (P1)

1. **Running API image ≠ `1.2.5`.** Production API is `candidate-abort-b042c11` (SHA `7926c03919a8…`), descendant of `d1e57c0` with later abort-seal / service-auth commits **not** included in this V1.0 git tag.
2. **Hybrid GPU URL drift.** `laptopOllamaBaseUrl` is `other_ip` (not original laptop Tailscale `100.105.217.7`). Stopping laptop Ollama does not fail the hybrid GPU node. Failover was proven via the approved router disable method.
3. **Login is not 429-rate-limited** in a 15-attempt burst (still 400). AI chat/admin routes remain rate-limited.
4. **Legacy `/health` `ollama` field** tracks default `OLLAMA_BASE_URL`, not necessarily the hybrid preferred GPU node.

---

## 11. Modified files (this phase)

- `docs/ZRHLBR-AI-V1.0-Final-Production-Report.md`

## 12. Not modified modules

- Accounts business logic
- Global Commerce business logic
- ZRHPay
- Wallet
- Ledger
- Payment
- Production database business rows (no SQL writes). AI conversation rows created only by verification chats; admin profile language restored to `zh-CN`.

---

## 13. Git / Release (filled after freeze + merge + tag)

| Key | Value |
|-----|--------|
| FINAL_FREEZE_COMMIT | *(set after freeze commit)* |
| MAIN_RELEASE_COMMIT | *(set after merge main)* |
| RELEASE_TAG | `zrh-ai-v1.0.0` *(after annotated tag)* |

---

**FINAL_ACCEPTANCE=PASS**  
**PRODUCTION_STATUS=ACCEPTED**
