# ZRHLBR Hybrid Inference V1.0 Report

**Date:** 2026-08-08  
**Branch:** `test/v1.2`  
**Status:** Test-environment implementation complete — **Production AI Router NOT switched**  
**Awaiting:** 赵总最终批准 Production cutover

---

## 1. Server Tailscale 状态

| Item | Value |
|------|-------|
| Hostname | `zrh-server` |
| OS | Ubuntu 24.04 (SA5212M5) |
| **SERVER_TAILSCALE_IP** | `100.83.172.96` |
| CPU / RAM / Disk | 96 threads · ~251 Gi RAM · 3.5T NVMe (~2% used) |
| Docker | healthy (`zrh-ai-*` stack present) |
| Tailscale ↔ Laptop | `tailscale ping` OK (~3–5 ms via LAN path) |

## 2. Laptop Tailscale 状态

| Item | Value |
|------|-------|
| Hostname | Windows 11 Lenovo Legion (`node` in Tailscale) |
| **LAPTOP_TAILSCALE_IP** | `100.105.217.7` |
| GPU | NVIDIA GeForce RTX 5060 Laptop GPU (driver 573.24, 8 GiB VRAM) |
| Tailscale ↔ Server | ping / `tailscale ping` OK (~3–5 ms) |

## 3. SSH / Termius 验证

| Item | Result |
|------|--------|
| OpenSSH Server installed | **NO** (needs Administrator) |
| `sshd` auto-start | **PENDING** |
| Termius via Tailscale IP | **NOT VERIFIED** — blocked by missing OpenSSH Server |

**Action for 赵总 (Admin PowerShell):**

```powershell
# Run elevated:
Set-ExecutionPolicy -Scope Process Bypass -Force
.\scripts\hybrid-laptop-harden.ps1
```

Script installs OpenSSH Server, sets Automatic start, and locks 11434 to Server Tailscale IP only.

## 4. RTX 5060 Ollama 状态

| Item | Value |
|------|-------|
| Ollama | `0.32.6` |
| Models | `qwen2.5-coder:7b`, `qwen3:8b`, `deepseek-r1:8b`, `deepseek-coder`, `nomic-embed-text` |
| Smoke generate | `hello-gpu` OK |
| Processor | **100% GPU** (`ollama ps`) |
| Listener | `0.0.0.0:11434` (process bind) |
| Server access via TS | `curl http://100.105.217.7:11434/api/tags` → **200** |
| LAN `192.168.10.61:11434` | unreachable from server at audit time |

## 5. Server CPU Ollama 状态

| Item | Value |
|------|-------|
| Container | `zrh-ollama-cpu` (`ollama/ollama:latest`) |
| Volume | `zrh-ollama-cpu-data` (new, independent of Postgres/Redis) |
| Bind | **`127.0.0.1:11434` only** |
| Models | `qwen2.5-coder:7b`, `qwen3:8b` |
| Internet exposure | Not bound on public iface |

## 6. 模型列表

### Laptop GPU
- qwen2.5-coder:7b (4.7 GB)
- qwen3:8b (5.2 GB)
- deepseek-r1:8b, deepseek-coder, nomic-embed-text

### Server CPU
- qwen2.5-coder:7b (4.7 GB)
- qwen3:8b (5.2 GB)

### Logical mapping (Hybrid)

| Logical | Physical |
|---------|----------|
| `chat-default` | `qwen3:8b` |
| `coder-default` | `qwen2.5-coder:7b` |

## 7. GPU Benchmark (RTX 5060 · real)

Same prompts, `stream:false`, measured from Ollama timings.

| Case | Model | TTFT (ms) | tokens/s | Total (ms) | Processor |
|------|-------|-----------|----------|------------|-----------|
| chat | qwen3:8b | 169.2 | 55.07 | 5677 | 100% GPU |
| codegen | qwen2.5-coder:7b | 59.0 | 54.40 | 7391 | 100% GPU |
| explain | qwen2.5-coder:7b | 36.2 | 56.58 | 2355 | 100% GPU |
| bug | qwen2.5-coder:7b | 30.8 | 58.21 | 1365 | 100% GPU |
| longctx | qwen3:8b | 331.8 | 53.04 | 6446 | 100% GPU |

## 8. CPU Benchmark (SA5212M5 · real)

Concurrency **1** (same prompts as GPU):

| Case | Model | TTFT (ms) | tokens/s | Total (ms) | Wall (ms) |
|------|-------|-----------|----------|------------|-----------|
| chat | qwen3:8b | 248.6 | 10.37 | 17460 | 17532 |
| codegen | qwen2.5-coder:7b | 409.2 | 11.54 | 21005 | 21010 |
| explain | qwen2.5-coder:7b | 263.5 | 11.57 | 11512 | 11517 |
| bug | qwen2.5-coder:7b | 257.9 | 11.15 | 6578 | 6583 |
| longctx | qwen3:8b | 4444.5 | 7.80 | 11497 | 11506 |

Concurrency **2** (short prompts, `qwen2.5-coder:7b`): wall_total ≈ **1920 ms**; per-stream ~14–17 tok/s observed (shared CPU contention).

## 9. 实际性能差距（真实体验）

| Metric | RTX 5060 GPU | SA5212M5 CPU | Ratio (GPU faster) |
|--------|--------------|--------------|--------------------|
| Typical tokens/s | ~53–58 | ~8–12 | **~5×** |
| Short-prompt TTFT | ~30–170 ms | ~250–410 ms | **~2–8×** |
| Long-context TTFT | ~332 ms | ~4445 ms | **~13×** |
| Codegen total (160 tok budget) | ~7.4 s | ~21 s | **~2.8×** |
| User experience | Snappy chat / coding | Usable fallback, slower | GPU preferred when online |

**Verdict:** Laptop GPU is clearly preferred for interactive UX; Server CPU is a solid 24×7 safety net (~10 tok/s).

## 10. Hybrid Router 架构

```
User → ZRHLBR API → AIGatewayService
                 → HybridInferenceRouter (if HYBRID_INFERENCE_ENABLED=true)
                      Priority1: laptop-gpu  (Tailscale Ollama)
                      Priority2: server-cpu  (localhost Ollama)
                 else legacy OLLAMA_BASE_URL / ModelRouter
```

**Default:** `HYBRID_INFERENCE_ENABLED=false` — Production path unchanged until 赵总批准.

**Strategy:** `GPU_FIRST_WITH_CPU_FAILOVER`  
**Modes (SUPER_ADMIN):** `AUTO` / `GPU_ONLY` / `CPU_ONLY`

Key files:
- `backend/src/ai/hybrid/hybrid-inference.router.ts`
- `backend/src/ai/hybrid/hybrid-inference.config.ts`
- `backend/src/ai/hybrid/circuit-breaker.ts`
- `backend/src/ai/gateway/ai-gateway.service.ts`
- `backend/src/superadmin/ai-infra.controller.ts`
- `frontend/src/pages/AiInfraView.tsx`

## 11. Health Check

- Probe: `GET /api/tags` only (no generation)
- Timeout: ~1800 ms (`HYBRID_HEALTH_TIMEOUT_MS`)
- Interval: 15 s
- Unhealthy after **2** consecutive failures
- Recovering → HEALTHY after **3** consecutive successes

## 12. Circuit Breaker

- GPU node: 3 consecutive inference failures → `OPEN`
- Cool-down ~45 s → `HALF_OPEN` probe
- Success → `CLOSED`
- Self-test: `node scripts/hybrid-circuit-breaker-selftest.mjs` → **PASS**

## 13. Failover

- Laptop unreachable / unhealthy → route to `server-cpu`
- Must not 500/infinite-load when CPU healthy
- Both down → `AI_SERVICE_UNAVAILABLE`

## 14. Auto Recovery

- Laptop returns → `RECOVERING` until 3 healthy probes → `HEALTHY`
- In-flight CPU requests are **not** migrated mid-flight
- New requests prefer GPU again when HEALTHY

## 15. SSE Failover

| Stage | Behavior |
|-------|----------|
| A. Before request / GPU down | Direct CPU |
| B. Pre-first-token failure | Automatic CPU retry |
| C. After tokens emitted | **No CPU splice** → `AI_STREAM_PROVIDER_FAILED_NO_SPLICE` |

## 16. 安全检查

| Rule | Status |
|------|--------|
| No delete of existing laptop models | OK |
| No Postgres/Redis volume rebuild | OK |
| No CF DNS → laptop | OK |
| No user DB / secrets copied to laptop | OK |
| Provider URLs not in React hardcode | OK (backend env + SUPER_ADMIN API) |
| USER cannot call `/superadmin/ai/*` | Dual gate: permission + `assertSuper` |

## 17. 公网 11434 检查

| Target | Result |
|--------|--------|
| Server bind | `127.0.0.1:11434` only |
| Server public iface :11434 | unreachable |
| Laptop | Still has broad `ollama.exe` Allow Any rules (**needs Admin harden script**) |
| Tailscale path Server→Laptop | Working |

**Risk:** Until harden script runs as Admin, laptop 11434 may accept non-Tailscale sources if network-reachable. Prefer running `scripts/hybrid-laptop-harden.ps1` ASAP.

## 18. USER 信息泄露检查

- Internal URLs only on `GET /superadmin/ai/inference` (SUPER_ADMIN)
- Ordinary chat/AI USER APIs do not expose Tailscale/LAN IPs
- Frontend `AiInfraView` only mounted under `/superadmin/ai`

## 19. TypeCheck

- Backend `npm run typecheck` → **PASS**
- Frontend `npm run typecheck` → **PASS**

## 20. Build

- Frontend `npm run build` → **PASS**
- Backend `npm run build` → **PASS**

## 21. Integration Test

| # | Case | Result |
|---|------|--------|
| 1 | Laptop ON → GPU path (direct Ollama) | **PASS** (100% GPU) |
| 2 | Laptop OFF → CPU | **PENDING** (needs Hybrid flag on test stack + deploy) |
| 3 | Laptop recover → GPU | **PENDING** (code ready) |
| 4 | Network drop → CPU | **PENDING** |
| 5 | Ollama crash → CPU | **PENDING** |
| 6 | CPU stop, GPU online → GPU | **PENDING** |
| 7 | Both offline → AI_SERVICE_UNAVAILABLE | **Code ready** |
| 8 | SSE pre-token fail → CPU retry | **Code ready** |
| 9 | SSE mid-stream fail → no splice | **Code ready** |
| 10 | USER no internal IPs | **Code gate ready** |
| 11 | SSH/Termius Tailscale | **BLOCKED** (OpenSSH not installed) |
| 12 | Public 11434 | Server **PASS**; Laptop harden **PENDING Admin** |

Circuit breaker self-test: **PASS**

## 22. Git SHA

- Branch: `test/v1.2`
- Commit: `056db80a3466232f9b8d0e22d48857d2f803bfb3`
- Message: `feat(ai): add hybrid gpu priority cpu failover routing`
- Remote: **not pushed** (await 赵总)

## 23. Production Impact

| Item | Impact |
|------|--------|
| Production AI Router | **0** — flag default `false` |
| Production DNS / Cloudflare | **0** |
| Postgres / Redis volumes | **0** |
| Server CPU Ollama container | **Added** (`127.0.0.1:11434`) — does not replace current prod `OLLAMA_BASE_URL` until env change |
| Existing public business | Unchanged |

## 24. 回滚方案

1. Keep / set `HYBRID_INFERENCE_ENABLED=false` (immediate revert to legacy single `OLLAMA_BASE_URL`)
2. Optional: `docker stop zrh-ollama-cpu` (CPU node only; does not touch DB volumes)
3. Git revert the hybrid commit on `test/v1.2` if needed
4. Laptop firewall: re-enable prior rules if harden script caused issues

## 25. 是否具备 Production 切换资格

**NOT YET — Do not switch Production.**

Blockers / remaining:
1. Run `scripts/hybrid-laptop-harden.ps1` as Administrator (firewall + OpenSSH)
2. Verify Termius SSH to `100.105.217.7`
3. Enable Hybrid **only on test stack**, complete TEST 2–9 end-to-end
4. Fill CPU benchmark table with real numbers
5. 赵总书面批准 Production `HYBRID_INFERENCE_ENABLED=true` + Tailscale laptop URL

---

## Env (test)

```env
HYBRID_INFERENCE_ENABLED=false
HYBRID_ROUTING_MODE=AUTO
LAPTOP_OLLAMA_BASE_URL=http://100.105.217.7:11434
SERVER_OLLAMA_BASE_URL=http://host.docker.internal:11434
```

## Commit suggestion (after final bench fill)

```
feat(ai): add hybrid gpu priority cpu failover routing
```
