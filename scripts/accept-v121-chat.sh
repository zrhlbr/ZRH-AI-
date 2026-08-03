#!/usr/bin/env bash
set -euo pipefail
cd /home/zrh-admin/zrh-ai
BASE=http://127.0.0.1:4010/api/v1
U=$(grep -E '^ADMIN_USERNAME=' .env | cut -d= -f2-)
P=$(grep -E '^ADMIN_INITIAL_PASSWORD=' .env | cut -d= -f2-)
TOK=$(curl -sS -m 20 -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"account\":\"${U}\",\"password\":\"${P}\"}" | python3 -c 'import sys,json;d=json.load(sys.stdin);print((d.get("data") or {}).get("accessToken") or "")')
AH="Authorization: Bearer ${TOK}"

echo "=== chat list ==="
code=$(curl -sS -m 25 -o /tmp/clist.json -w '%{http_code}' -H "$AH" "$BASE/chat/list")
echo "GET /chat/list -> $code"
head -c 200 /tmp/clist.json; echo

echo "=== chat models ==="
code=$(curl -sS -m 25 -o /tmp/cmod.json -w '%{http_code}' -H "$AH" "$BASE/chat/models")
echo "GET /chat/models -> $code"
head -c 160 /tmp/cmod.json; echo

echo "=== chat SSE ==="
start=$(date +%s%3N)
# Capture first ~2KB of stream
curl -sS -m 55 -N -H "$AH" -H 'Content-Type: application/json' -H 'Accept: text/event-stream' \
  -X POST "$BASE/chat" -d '{"message":"acceptance ping v121","stream":true}' > /tmp/csse.txt || true
end=$(date +%s%3N)
echo "TIME|ChatSSE|$((end-start))ms bytes=$(wc -c </tmp/csse.txt)"
head -c 500 /tmp/csse.txt; echo
if grep -Eqi 'delta|done|meta|content|event' /tmp/csse.txt; then echo PASS|ChatSSE; else echo FAIL|ChatSSE; fi

echo "=== home timings x3 ==="
for i in 1 2 3; do
  t=$(curl -sS -m 20 -o /dev/null -w '%{time_total}' http://127.0.0.1:3010/)
  echo "home_$i=${t}s"
done
for i in 1 2 3; do
  t=$(curl -sS -m 20 -o /dev/null -w '%{time_total}' -H "$AH" "$BASE/knowledge/status")
  echo "knowledge_$i=${t}s"
done
for i in 1 2 3; do
  t=$(curl -sS -m 20 -o /dev/null -w '%{time_total}' -H "$AH" "$BASE/rag/health")
  echo "rag_$i=${t}s"
done
