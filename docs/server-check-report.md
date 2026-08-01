# ZRH AI Enterprise — Server Check Report

**Date:** 2026-08-01  
**Host:** `zrh-server` (Ubuntu 24.04.4 LTS)  
**Access:** LAN `192.168.10.74` / Tailscale `100.83.172.96` as `zrh-admin`  
**Git SHA (workspace):** `5244b4f6e26d8a607367205d558dc867ea13d27d`  
**Target domain:** `https://ai.zrhtech.com`

## Verdict

| Area | Status | Notes |
|------|--------|-------|
| Docker / Compose | **PASS** | Docker 29.6.1, Compose v5.3.1 |
| CPU / Memory / Disk | **PASS** | 96 vCPU, 251 GiB RAM, 3.5T (1% used) |
| Nginx (system) | **PASS (HTTP only)** | nginx/1.24.0 active on `:80`; **no `:443` listener** |
| Certbot | **INSTALLED** | certbot 2.9.0 — **no `/etc/letsencrypt/live` yet** |
| Node | **PASS** | v22.23.1 (host) |
| Fail2ban | **PASS** | active |
| PostgreSQL / Redis (host) | **PRESENT (other apps)** | bound to `127.0.0.1` — ZRH AI will use **dedicated containers** |
| Ollama / GPU | **FAIL** | no NVIDIA, no Ollama binary/service/container |
| DNS `ai.zrhtech.com` | **FAIL** | unresolved |
| Cloudflare API / token | **MISSING** | cannot create A record from this session |
| Passwordless sudo | **FAIL** | nginx reload / `/opt` mkdir need interactive sudo |
| Existing ZRH AI deploy | **ABSENT** | no `/opt/zrh-ai`, no `zrh-ai-*` containers on server |

## Hardware / OS

| Item | Value |
|------|-------|
| Kernel | `6.8.0-136-generic` x86_64 |
| CPU | 2× Intel Xeon Platinum 8163 @ 2.50GHz · 96 threads |
| Memory | 251 GiB total · ~244 GiB available |
| Disk `/` | 3.5T ext4 · 30G used · 3.3T free |
| Public IP (egress) | `150.228.149.126` (Starlink CGNAT/shared egress) |
| LAN | `192.168.10.74/24` |
| Tailscale | `100.83.172.96` |

## Software checklist

| Component | Result |
|-----------|--------|
| Docker | `Docker version 29.6.1` |
| Docker Compose | `v5.3.1` |
| Nginx | `nginx/1.24.0 (Ubuntu)` · `systemctl is-active nginx` → `active` |
| SSL / Let's Encrypt | certbot present · **no live certificates** · **443 not listening** |
| PostgreSQL (host) | listening `127.0.0.1:5432` (not for ZRH AI) |
| Redis (host) | listening `127.0.0.1:6379` (not for ZRH AI) |
| Node | `v22.23.1` |
| Fail2ban | `active` |

## Existing nginx vhosts (do not break)

| server_name | Upstream |
|-------------|----------|
| `account.zrhtech.com` | `127.0.0.1:8095` |
| `www.zrhtech.com` / `zrhtech.com` | shared gateway → 8080 / 8095 |
| `server.zrhtech.com` | `127.0.0.1:8080` |

Note: path `/ai` on `zrhtech.com` is currently a **reserved 503** placeholder. Subdomain `ai.zrhtech.com` is separate and preferred per this task.

## Running containers (sample)

Server already hosts Stage26/27 accounting/commerce UAT/prod stacks, Portainer, and `zrh-server-os-*`.  
**No `zrh-ai-*` containers** on this host at check time.

## Blockers (deployment paused until resolved)

Per production rules: **stop → analyze → do not modify business code**.

1. **SSH Tailscale `:22` intermittent / blocked** after failed auth probes — use LAN `192.168.10.74` for deploy ops.  
2. **No passwordless sudo** — cannot `systemctl reload nginx`, create `/opt/zrh/ai`, or run certbot as root without operator password.  
3. **`ai.zrhtech.com` DNS missing** — Cloudflare A record (Proxy) not created; no API token in environment.  
4. **HTTPS incomplete** — origin has no 443 / no LE certs; Cloudflare Full (Strict) needs origin cert or Flexible (not preferred).  
5. **Ollama missing on server** — chat / embedding / Enterprise RAG will be degraded until a model runtime is available on-host or reachable LAN (`192.168.10.61:11434` currently **not reachable** from server).

## Recommended operator actions before Phase 2–5 continue

```bash
# On zrh-server (with sudo)
sudo mkdir -p /opt/zrh/ai
sudo chown -R zrh-admin:zrh-admin /opt/zrh/ai

# After deploy writes nginx site:
sudo nginx -t && sudo systemctl reload nginx

# Cloudflare Dashboard (zrhtech.com zone):
# A  ai  -> <origin public IP or tunnel>  Proxied
# SSL/TLS: Full (Strict)
# Always Use HTTPS / HTTP3 / Brotli ON
```

Also install or expose Ollama for production model/embedding traffic.

## Isolation commitment

ZRH AI production compose uses `zrh-ai-*` names, dedicated network `zrh-ai-network`, dedicated volumes.  
It must **not** connect to existing ZRH Accounting / Server OS Postgres/Redis.
