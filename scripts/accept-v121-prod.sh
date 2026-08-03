#!/usr/bin/env bash
set -euo pipefail
cd /home/zrh-admin/zrh-ai
BASE=http://127.0.0.1:4010/api/v1
ADMIN_USER=$(grep -E '^ADMIN_USERNAME=' .env | cut -d= -f2-)
ADMIN_PASS=$(grep -E '^ADMIN_INITIAL_PASSWORD=' .env | cut -d= -f2-)
PASS=0
FAIL=0
ok() { echo "PASS|$1|$2"; PASS=$((PASS + 1)); }
bad() { echo "FAIL|$1|$2"; FAIL=$((FAIL + 1)); }

LOGIN=$(curl -sS -m 20 -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"account\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASS}\"}" || true)
TOKEN=$(echo "$LOGIN" | python3 -c 'import sys,json;d=json.load(sys.stdin);x=d.get("data") or d;print(x.get("accessToken") or "")' 2>/dev/null || true)
if [ -z "$TOKEN" ]; then
  LOGIN=$(curl -sS -m 20 -X POST "$BASE/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASS}\"}" || true)
  TOKEN=$(echo "$LOGIN" | python3 -c 'import sys,json;d=json.load(sys.stdin);x=d.get("data") or d;print(x.get("accessToken") or "")' 2>/dev/null || true)
fi
if [ -n "$TOKEN" ]; then ok "Login" "token_ok"; else bad "Login" "no_token"; fi
AUTH_HEADER="Authorization: Bearer ${TOKEN}"

check_any() {
  local name="$1"; shift
  local got=""
  local p code
  for p in "$@"; do
    code=$(curl -sS -m 25 -o /tmp/acc.json -w '%{http_code}' -H "$AUTH_HEADER" "${BASE}${p}" || echo 000)
    if [ "$code" = "200" ]; then
      ok "$name" "${p}:200"
      return 0
    fi
    got="${got}${p}:${code} "
  done
  bad "$name" "$got"
}

check_any "Profile" "/auth/profile" "/users/me"
check_any "Knowledge" "/knowledge/status" "/knowledge/health"
check_any "RAG" "/rag/health"
check_any "ChatList" "/chat/conversations"
check_any "Agents" "/agents/health" "/agents"
check_any "Workflows" "/workflows/health" "/workflows"
check_any "MCP" "/mcp/health" "/mcp/servers"
check_any "Admin" "/admin/users" "/admin/overview"
check_any "SuperAdmin" "/superadmin/overview" "/superadmin/health"
check_any "Developer" "/developer/health" "/developer/workspaces"
check_any "Business" "/business/systems" "/business/health"

start=$(date +%s%3N)
CHAT=$(curl -sS -m 50 -N -H "$AUTH_HEADER" -H 'Content-Type: application/json' -H 'Accept: text/event-stream' \
  -X POST "$BASE/chat" -d '{"message":"acceptance ping v1.2.1","stream":true}' || true)
end=$(date +%s%3N)
echo "TIME|ChatSSE|$((end - start))ms"
if echo "$CHAT" | grep -Eqi 'delta|done|meta|content|event'; then ok "ChatSSE" "events"; else bad "ChatSSE" "no_events"; fi

start=$(date +%s%3N)
RS=$(curl -sS -m 40 -H "$AUTH_HEADER" -H 'Content-Type: application/json' \
  -X POST "$BASE/rag/search" -d '{"query":"ZRH","topK":3}' || true)
end=$(date +%s%3N)
echo "TIME|RagSearch|$((end - start))ms"
if echo "$RS" | grep -Eqi 'results|items|data|hits|documents'; then ok "RagSearch" "ok"; else bad "RagSearch" "bad"; fi

start=$(date +%s%3N)
KS=$(curl -sS -m 25 -H "$AUTH_HEADER" "$BASE/knowledge/status" || true)
end=$(date +%s%3N)
echo "TIME|Knowledge|$((end - start))ms"
if echo "$KS" | grep -Eqi 'ok|online|parser|status|embedding'; then ok "KnowledgeTimed" "ok"; else bad "KnowledgeTimed" "bad"; fi

# Register endpoint probe (no create)
REG_CODE=$(curl -sS -m 15 -o /tmp/reg.json -w '%{http_code}' -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' -d '{}' || echo 000)
if [ "$REG_CODE" != "404" ]; then ok "RegisterEndpoint" "HTTP $REG_CODE"; else bad "RegisterEndpoint" "404"; fi

curl -sS -o /dev/null -w 'SPA=%{http_code}\n' http://127.0.0.1:3010/
curl -sS -o /dev/null -w 'SW=%{http_code}\n' 'http://127.0.0.1:3010/sw.js?v=1.2.1'
python3 - <<'PY'
import json,urllib.request
d=json.load(urllib.request.urlopen('http://127.0.0.1:3010/manifest.json'))
print('MANIFEST', d.get('display'), d.get('theme_color'), d.get('background_color'), d.get('start_url'), d.get('scope'))
PY

docker ps --filter name=zrh-ai --format '{{.Names}} {{.Image}} {{.Status}}'
echo "SUMMARY|PASS=${PASS}|FAIL=${FAIL}"
test "$FAIL" -eq 0
