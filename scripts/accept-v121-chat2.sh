#!/usr/bin/env bash
set -euo pipefail
cd /home/zrh-admin/zrh-ai
BASE=http://127.0.0.1:4010/api/v1
U=$(grep -E '^ADMIN_USERNAME=' .env | cut -d= -f2-)
P=$(grep -E '^ADMIN_INITIAL_PASSWORD=' .env | cut -d= -f2-)
TOK=$(curl -sS -m 20 -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"account\":\"${U}\",\"password\":\"${P}\"}" | python3 -c 'import sys,json;d=json.load(sys.stdin);print((d.get("data") or {}).get("accessToken") or "")')
AH="Authorization: Bearer ${TOK}"

echo "GET /chat/list"
curl -sS -m 25 -o /tmp/clist.json -w 'code=%{http_code}\n' -H "$AH" "$BASE/chat/list"
head -c 160 /tmp/clist.json; echo

echo "POST /chat SSE"
start=$(date +%s%3N)
curl -sS -m 70 -N -H "$AH" -H 'Content-Type: application/json' -H 'Accept: text/event-stream' \
  -X POST "$BASE/chat" -d '{"message":"acceptance ping v121"}' > /tmp/csse.txt || true
end=$(date +%s%3N)
echo "TIME|ChatSSE|$((end-start))ms bytes=$(wc -c </tmp/csse.txt)"
head -c 600 /tmp/csse.txt; echo
if grep -Eqi 'delta|done|meta|content|event' /tmp/csse.txt; then echo 'PASS|ChatSSE'; else echo 'FAIL|ChatSSE'; fi

echo "PERF home/knowledge/rag"
for i in 1 2 3; do echo -n "home_$i="; curl -sS -m 20 -o /dev/null -w '%{time_total}\n' http://127.0.0.1:3010/; done
for i in 1 2 3; do echo -n "knowledge_$i="; curl -sS -m 20 -o /dev/null -w '%{time_total}\n' -H "$AH" "$BASE/knowledge/status"; done
for i in 1 2 3; do echo -n "rag_$i="; curl -sS -m 20 -o /dev/null -w '%{time_total}\n' -H "$AH" "$BASE/rag/health"; done
