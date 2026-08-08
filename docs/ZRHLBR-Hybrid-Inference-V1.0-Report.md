# ZRHLBR Hybrid Inference V1.0 — Final Test Acceptance Report

**Date:** 2026-08-08  
**Branch:** `test/v1.2`  
**Feature SHA:** `056db80`  
**Docs SHA (prior):** `6102085`  
**Production AI Router:** **OFF** (`HYBRID_INFERENCE_ENABLED` absent / false in Production `.env`)  
**Push / Merge / Prod cutover:** **NOT performed** — awaiting 赵总最终批准

---

## Scorecard (required)

| Key | Result |
|-----|--------|
| **TEST_1_9** | **PASS** |
| **GPU_PRIORITY** | **PASS** |
| **CPU_FAILOVER** | **PASS** |
| **GPU_AUTO_RECOVERY** | **PASS** |
| **CIRCUIT_BREAKER** | **PASS** |
| **SSE_FAILOVER** | **PASS** |
| **TERMIUS_SSH** | **PASS** |
| **PUBLIC_11434_BLOCKED** | **PASS** |
| **USER_INTERNAL_INFO_LEAK** | **PASS** |
| **REGRESSION** | **PASS** (Test stack health + Login/SUPER_ADMIN + typecheck/build; Prod untouched) |
| **PRODUCTION_IMPACT** | **0** |
| **PRODUCTION_READY_CANDIDATE** | **YES** |

---

## 1. Independent Test Stack

| Container | Status |
|-----------|--------|
| `zrh-ai-test-web` | Up |
| `zrh-ai-test-api` | healthy |
| `zrh-ai-test-postgres` | healthy (volume `zrh-ai-test-postgres-data`) |
| `zrh-ai-test-redis` | healthy (volume `zrh-ai-test-redis-data`) |
| `zrh-ai-test-dev-runner` | healthy |
| `zrh-ai-test-ollama-cpu` | healthy (CPU fallback, models via external `zrh-ollama-cpu-data`) |

- Project: `zrh-ai-test` / network: `zrh-ai-test-network`
- Ports: `127.0.0.1:3011` (web), `127.0.0.1:4011` (api)
- Test `.env.test`: `HYBRID_INFERENCE_ENABLED=true`
- Production `.env`: **no HYBRID keys**; `zrh-ai-api` still healthy, unchanged Router

## 2. Network IPs

| Role | Tailscale IP |
|------|----------------|
| Server SA5212M5 | `100.83.172.96` |
| Laptop RTX 5060 | `100.105.217.7` |

Inference path: **Tailscale HTTP API only** (not SSH).

## 3. Laptop Harden + Control

- Script: `scripts/hybrid-laptop-harden.ps1` (Admin) — executed
- Script: `scripts/hybrid-laptop-ollama-ctl.ps1` — `status|stop|start|restart|models|gpu|ping11434`
- Firewall:
  - `ZRH-Ollama-Tailscale-11434` **Enabled Allow** Remote=`100.83.172.96` Port=`11434`
  - Broad `ollama.exe` Any rules **Disabled**
  - LAN 11434 rule **Disabled**
- OpenSSH Server: **Running / Automatic**
- Localhost Ollama: preserved (`127.0.0.1` works after start)
- Models: `qwen2.5-coder:7b`, `qwen3:8b` present

### Live stop/start evidence
- After `ctl stop`: Server `curl` laptop tags → **fail** (`000`)
- After `ctl start`: Server tags → **200**; generate `gpu-proof` @ **~59 tok/s**; `ollama ps` → **100% GPU**

## 4. SSH / Termius

From Server Tailscale → `zhaor@100.105.217.7`:
- `hostname` OK
- `whoami` → `电脑\zhaor`
- `ollama list` OK
- `nvidia-smi` → RTX 5060
- `ollama ps` OK  

**SSH = management only.** Inference remains HTTP `:11434` over Tailscale.

## 5. TEST 1–9 (Test API `127.0.0.1:4011`)

| Test | Expected | Result | Evidence |
|------|----------|--------|----------|
| 1 | GPU priority `laptop-gpu` | **PASS** | `currentPreferred=laptop-gpu`, health HEALTHY, latency ~18ms |
| 2 | CPU failover | **PASS** | preferred `server-cpu`, chat body `cpu-fallback-ok` |
| 3 | Auto recovery GPU | **PASS** | RECOVERING→HEALTHY→preferred `laptop-gpu` |
| 4 | Network-loss → CPU | **PASS** | preferred `server-cpu` |
| 5 | Network restore → GPU | **PASS** | preferred `laptop-gpu` |
| 6 | CPU down, GPU ok | **PASS** | stop `zrh-ai-test-ollama-cpu`; chat `gpu-only-ok` |
| 7 | Both down → unavailable | **PASS** | SSE `{"type":"error","message":"AI_SERVICE_UNAVAILABLE"}` (no fake success) |
| 8 | Pre-token → CPU retry | **PASS** | `scripts/hybrid-e2e-acceptance.mjs` |
| 9 | Mid-stream → no splice | **PASS** | same; code `AI_STREAM_PROVIDER_FAILED_NO_SPLICE` |

## 6. Circuit Breaker

- Self-test `scripts/hybrid-circuit-breaker-selftest.mjs`: **PASS** (CLOSED→OPEN→HALF_OPEN→CLOSED; no flap while OPEN)
- Runtime snap fields present (`circuit`: CLOSED/OPEN/HALF_OPEN)

## 7. SSE Failover

- Pre-token failure → CPU retry: **PASS**
- Post-token failure → no CPU splice: **PASS**
- Both fail → `AI_SERVICE_UNAVAILABLE`: **PASS**

## 8. Security

| Check | Result |
|-------|--------|
| Laptop 11434 firewall only Server TS IP | **PASS** |
| Server CPU Ollama bind `127.0.0.1:11434` only | **PASS** |
| Public server iface `:11434` | **blocked** (HTTP 000) |
| USER `/ai/providers` has no Tailscale/11434 URLs | **PASS** |
| SUPER_ADMIN `/superadmin/ai/inference` shows internal URLs | **PASS** (no secrets/passwords) |
| No Production DB / JWT / SMTP copied to laptop | **PASS** (inference-only node) |

## 9. Regression / Gates

| Gate | Result |
|------|--------|
| Backend typecheck | PASS |
| Frontend typecheck | PASS |
| Backend build | PASS |
| Frontend build | PASS |
| Hybrid/circuit/SSE self-tests | PASS |
| Test API health (db/redis/ollama) | PASS |
| SUPER_ADMIN login on Test | PASS |
| Production containers | untouched / still healthy |

## 10. Performance (reference, real)

| Node | tokens/s | Notes |
|------|----------|-------|
| RTX 5060 (via TS from Server) | ~53–59 | `100% GPU` |
| SA5212M5 CPU | ~8–12 | prior bench |

## 11. Production Impact

**0**
- Production Router not enabled
- Production `.env` not modified with Hybrid keys
- No Push / Merge / Tag / DNS change

## 12. Rollback

1. `docker compose -p zrh-ai-test -f docker-compose.test.yml --env-file .env.test down` (Test only)
2. Keep Production `HYBRID_INFERENCE_ENABLED` unset/false
3. Optional: stop `zrh-ai-test-ollama-cpu` / remove Test volumes if desired (never touch prod volumes)
4. Git revert `056db80` on `test/v1.2` if code rollback needed

## 13. PRODUCTION_READY_CANDIDATE

**YES** — Test acceptance complete.

**Still forbidden without 赵总批准:** Production Router on, Push, Merge, Tag, Deploy Prod.

---

## Scripts added/used

- `scripts/hybrid-laptop-harden.ps1`
- `scripts/hybrid-laptop-ollama-ctl.ps1`
- `scripts/hybrid-test-e2e.py`
- `scripts/hybrid-e2e-acceptance.mjs`
- `scripts/hybrid-circuit-breaker-selftest.mjs`
- `scripts/hybrid-live-failover.mjs`
