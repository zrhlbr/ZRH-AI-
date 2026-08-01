#!/bin/sh
set -eu
USER="${ADMIN_USERNAME:-admin}"
PASS="${ADMIN_INITIAL_PASSWORD:-}"
LOGIN=$(wget -qO- --header='Content-Type: application/json' \
  --post-data="{\"username\":\"${USER}\",\"password\":\"${PASS}\"}" \
  http://127.0.0.1:4010/api/v1/auth/login)
TOKEN=$(printf '%s' "$LOGIN" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ]; then
  echo "LOGIN_FAILED"
  exit 1
fi
echo "LOGIN_OK"

smoke() {
  label="$1"
  msg="$2"
  echo "=== $label ==="
  OUT=$(wget -qO- --header="Authorization: Bearer ${TOKEN}" \
    --header='Content-Type: application/json' \
    --post-data="{\"message\":\"${msg}\"}" \
    http://127.0.0.1:4010/api/v1/chat || true)
  echo "$OUT" | awk '
    BEGIN { hit=""; cit=0; deltas=0; doneHit=""; status="" }
    /^data: / {
      line=$0; sub(/^data: /,"",line)
      if (line == "[DONE]") next
      if (line ~ /"type":"rag"/) {
        if (line ~ /"hit":true/) hit="true"; else if (line ~ /"hit":false/) hit="false"
        n=split(line, a, /"index":/)
        if (n>1) cit=n-1
      }
      if (line ~ /"type":"delta"/) deltas++
      if (line ~ /"type":"done"/) {
        if (line ~ /"ragHit":true/) doneHit="true"
        else if (line ~ /"ragHit":false/) doneHit="false"
        if (match(line, /"status":"[^"]+"/)) {
          s=substr(line, RSTART, RLENGTH); gsub(/"status":"/,"",s); gsub(/"/,"",s); status=s
        }
      }
    }
    END { print "rag.hit=" hit " citations~=" cit " deltas=" deltas " done.ragHit=" doneHit " done.status=" status }
  '
  echo "$OUT" | grep -m1 '"type":"rag"' | head -c 500 || true
  echo
}

smoke HIT 'ZRH TECH founders who'
smoke MISS 'what is the weather today casually'
