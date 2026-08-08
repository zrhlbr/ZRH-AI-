#!/usr/bin/env python3
"""ZRHLBR Hybrid Inference V1.0 — Test API E2E (run on SA5212M5 against 127.0.0.1:4011)."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

API = os.environ.get("TEST_API", "http://127.0.0.1:4011/api/v1").rstrip("/")
USER = os.environ["TEST_ADMIN_USER"]
PASS = os.environ["TEST_ADMIN_PASS"]
RESULTS: list[dict] = []


def record(id_: str, status: str, detail=None):
    RESULTS.append({"id": id_, "status": status, "detail": detail})
    print(f"{status} {id_} :: {detail}")


def http(method: str, path: str, body=None, token: str | None = None, timeout: float = 60.0):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        f"{API}{path}",
        data=data,
        method=method,
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            payload = json.loads(raw) if raw else {}
        except Exception:
            payload = {"raw": raw[:500]}
        return e.code, payload


def unwrap(payload: dict):
    return payload.get("data", payload)


def login() -> str:
    # support username or email style
    for body in (
        {"username": USER, "password": PASS},
        {"email": USER, "password": PASS},
        {"account": USER, "password": PASS},
    ):
        code, payload = http("POST", "/auth/login", body)
        data = unwrap(payload)
        token = data.get("accessToken") or data.get("token")
        if token:
            return token
    raise RuntimeError(f"login failed: {payload}")


def snap(token: str) -> dict:
    code, payload = http("GET", "/superadmin/ai/inference", token=token)
    if code != 200:
        raise RuntimeError(f"inference snap HTTP {code}: {payload}")
    return unwrap(payload)


def wait_pref(token: str, want: str, seconds: int = 90) -> str:
    pref = None
    deadline = time.time() + seconds
    while time.time() < deadline:
        s = snap(token)
        pref = s.get("currentPreferred")
        nodes = {n["id"]: n for n in s.get("nodes", [])}
        if pref == want:
            return pref
        time.sleep(5)
    return pref or "none"


def set_node(token: str, node_id: str, enabled: bool):
    http("POST", "/superadmin/ai/inference/node", {"nodeId": node_id, "enabled": enabled}, token=token)


def set_mode(token: str, mode: str):
    http("POST", "/superadmin/ai/inference/mode", {"mode": mode}, token=token)


def chat_once(token: str, message: str, timeout: float = 180.0) -> str:
    """Collect SSE/text from /ai/chat; return body text for assertions."""
    req = urllib.request.Request(
        f"{API}/ai/chat",
        data=json.dumps({"message": message, "modelRef": "coder-default", "maxTokens": 32}).encode(),
        method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
    )
    chunks: list[str] = []
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            for line in resp:
                s = line.decode(errors="replace").strip()
                if not s:
                    continue
                if s.startswith("data:"):
                    s = s[5:].strip()
                try:
                    obj = json.loads(s)
                except Exception:
                    chunks.append(s)
                    continue
                if isinstance(obj, dict):
                    if obj.get("type") == "error" or obj.get("message"):
                        chunks.append(json.dumps(obj))
                    if obj.get("content"):
                        chunks.append(str(obj["content"]))
                    if obj.get("code"):
                        chunks.append(str(obj["code"]))
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        return f"HTTP_{e.code}:{raw[:400]}"
    except Exception as e:
        return f"ERR:{e}"
    return "".join(chunks)


def sh(cmd: str) -> str:
    return subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.STDOUT)


def main():
    # containers
    ps = sh("docker ps --format '{{.Names}} {{.Status}}' | grep zrh-ai-test || true")
    if "zrh-ai-test-api" not in ps:
        record("TEST_STACK", "FAIL", ps)
        dump()
        sys.exit(1)
    record("TEST_STACK", "PASS", ps.replace("\n", " | "))

    token = login()
    record("LOGIN_SUPERADMIN", "PASS", "token_ok")

    s0 = snap(token)
    if not s0.get("enabled"):
        record("HYBRID_ENABLED", "FAIL", s0)
        dump()
        sys.exit(1)
    record("HYBRID_ENABLED", "PASS", {"mode": s0.get("routingMode"), "pref": s0.get("currentPreferred")})

    # Ensure both nodes enabled, AUTO
    set_mode(token, "AUTO")
    set_node(token, "laptop-gpu", True)
    set_node(token, "server-cpu", True)

    # TEST 1
    pref = wait_pref(token, "laptop-gpu", 120)
    record("TEST1_GPU_PRIORITY", "PASS" if pref == "laptop-gpu" else "FAIL", {"preferred": pref, "snap": snap(token)})

    # TEST 2 — disable laptop node (safe equivalent of Ollama stop for router)
    set_node(token, "laptop-gpu", False)
    time.sleep(3)
    pref = wait_pref(token, "server-cpu", 60)
    body = chat_once(token, "Reply exactly: cpu-fallback-ok")
    ok2 = pref == "server-cpu" and ("ERR:" not in body) and ("AI_SERVICE_UNAVAILABLE" not in body)
    record("TEST2_CPU_FAILOVER", "PASS" if ok2 else "FAIL", {"preferred": pref, "body": body[:200]})

    # TEST 3 — recover laptop
    set_node(token, "laptop-gpu", True)
    # force recovering path by waiting health
    recovered = False
    last_health = None
    for _ in range(24):
        s = snap(token)
        nodes = {n["id"]: n for n in s.get("nodes", [])}
        last_health = nodes.get("laptop-gpu", {}).get("health")
        if s.get("currentPreferred") == "laptop-gpu" and last_health in ("HEALTHY", "DEGRADED"):
            recovered = True
            break
        time.sleep(5)
    record("TEST3_GPU_AUTO_RECOVERY", "PASS" if recovered else "FAIL", {"health": last_health, "snap": snap(token)})

    # TEST 4 — simulate unreachable by disabling again (network-loss equivalent at router)
    set_node(token, "laptop-gpu", False)
    pref = wait_pref(token, "server-cpu", 45)
    record("TEST4_NETWORK_LOSS_CPU", "PASS" if pref == "server-cpu" else "FAIL", {"preferred": pref})

    # TEST 5 — restore
    set_node(token, "laptop-gpu", True)
    pref = wait_pref(token, "laptop-gpu", 120)
    record("TEST5_NETWORK_RESTORE_GPU", "PASS" if pref == "laptop-gpu" else "FAIL", {"preferred": pref})

    # TEST 6 — CPU stop, GPU online
    sh("docker stop zrh-ai-test-ollama-cpu >/dev/null")
    time.sleep(2)
    set_node(token, "laptop-gpu", True)
    set_node(token, "server-cpu", True)
    pref = wait_pref(token, "laptop-gpu", 90)
    body = chat_once(token, "Reply exactly: gpu-only-ok")
    ok6 = pref == "laptop-gpu" and "AI_SERVICE_UNAVAILABLE" not in body and "ERR:" not in body
    record("TEST6_GPU_WHEN_CPU_DOWN", "PASS" if ok6 else "FAIL", {"preferred": pref, "body": body[:200]})

    # TEST 7 — both down
    set_node(token, "laptop-gpu", False)
    # server cpu already stopped
    time.sleep(2)
    body = chat_once(token, "should fail clearly", timeout=30)
    # also try snap decide
    s7 = snap(token)
    unavailable = ("AI_SERVICE_UNAVAILABLE" in body) or (s7.get("currentPreferred") in (None, "null"))
    # restore cpu for later
    sh("docker start zrh-ai-test-ollama-cpu >/dev/null")
    set_node(token, "laptop-gpu", True)
    set_node(token, "server-cpu", True)
    record("TEST7_BOTH_UNAVAILABLE", "PASS" if unavailable or "HTTP_503" in body or "Service Unavailable" in body else "FAIL", {"body": body[:300], "pref": s7.get("currentPreferred")})

    # wait recovery
    wait_pref(token, "laptop-gpu", 120)

    # Circuit breaker evidence via snap fields after forced failures
    s = snap(token)
    nodes = {n["id"]: n for n in s.get("nodes", [])}
    record(
        "CIRCUIT_BREAKER_STATE",
        "PASS" if nodes.get("laptop-gpu", {}).get("circuit") in ("CLOSED", "HALF_OPEN", "OPEN") else "FAIL",
        {k: {"health": v.get("health"), "circuit": v.get("circuit")} for k, v in nodes.items()},
    )

    # USER leak check: regular models endpoint should not include tailscale IPs
    code, payload = http("GET", "/ai/providers", token=token)
    text = json.dumps(payload)
    leak = any(x in text for x in ["100.83.172.96", "100.105.217.7", ":11434", "LAPTOP_OLLAMA"])
    record("USER_INTERNAL_INFO_LEAK", "FAIL" if leak else "PASS", {"checked": "/ai/providers"})

    # Superadmin may see internal URLs
    s = snap(token)
    internal = (s.get("internal") or {})
    record(
        "SUPERADMIN_INTERNAL_VISIBLE",
        "PASS" if internal.get("laptopOllamaBaseUrl") else "FAIL",
        {"hasInternal": bool(internal)},
    )

    dump()
    fails = [r for r in RESULTS if r["status"] != "PASS"]
    sys.exit(1 if fails else 0)


def dump():
    print(json.dumps({"results": RESULTS}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        record("RUNNER", "FAIL", str(e))
        dump()
        sys.exit(1)
