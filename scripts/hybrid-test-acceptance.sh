#!/bin/bash
# ZRHLBR Hybrid Inference — Test-stack acceptance runner (runs ON SA5212M5)
# Controls: does NOT touch Production compose / .env
set -euo pipefail
API="${TEST_API:-http://127.0.0.1:4011/api/v1}"
REPORT=/tmp/hybrid-acceptance-report.json
COOKIE=/tmp/hybrid-test-cookie.txt
rm -f "$COOKIE"
results=()

pass() { results+=("{\"id\":\"$1\",\"status\":\"PASS\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "${2:-}") }"); echo "PASS $1 — $2"; }
fail() { results+=("{\"id\":\"$1\",\"status\":\"FAIL\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "${2:-}") }"); echo "FAIL $1 — $2"; }

json_get() { python3 -c 'import json,sys; d=json.load(sys.stdin); print(d'"$1"')'; }

echo "=== login SUPER_ADMIN on TEST ==="
# credentials from env file names only — values injected by caller
: "${TEST_ADMIN_USER:?}"
: "${TEST_ADMIN_PASS:?}"
login=$(curl -sS -c "$COOKIE" -b "$COOKIE" -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$TEST_ADMIN_USER\",\"password\":\"$TEST_ADMIN_PASS\"}")
echo "$login" | head -c 200; echo
token=$(echo "$login" | python3 -c 'import json,sys; d=json.load(sys.stdin); print((d.get("data") or d).get("accessToken") or (d.get("data") or d).get("token") or "")')
if [[ -z "$token" ]]; then
  # try email login shape
  token=$(echo "$login" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(json.dumps(d))' >/dev/null; echo "$login" | python3 - <<'PY'
import json,sys
d=json.load(sys.stdin)
# unwrap common shapes
for path in (lambda x:x.get('data',{}).get('accessToken'), lambda x:x.get('accessToken'), lambda x:x.get('data',{}).get('token')):
  try:
    v=path(d)
    if v:
      print(v); break
  except Exception:
    pass
PY
)
fi
AUTH=(-H "Authorization: Bearer $token" -H 'Content-Type: application/json')

echo "=== infra snapshot ==="
snap=$(curl -sS "${AUTH[@]}" "$API/superadmin/ai/inference")
echo "$snap" | python3 -m json.tool | head -80
enabled=$(echo "$snap" | python3 -c 'import json,sys; d=json.load(sys.stdin); x=d.get("data",d); print(x.get("enabled"))')
pref=$(echo "$snap" | python3 -c 'import json,sys; d=json.load(sys.stdin); x=d.get("data",d); print(x.get("currentPreferred"))')
[[ "$enabled" == "True" || "$enabled" == "true" ]] && pass TEST_STACK_HYBRID_ON "enabled=$enabled pref=$pref" || fail TEST_STACK_HYBRID_ON "enabled=$enabled"

# Helper: one-shot generate via gateway chat if available
gen_once() {
  local msg="$1"
  curl -sS -N "${AUTH[@]}" -X POST "$API/ai/chat" \
    -d "{\"message\":\"$msg\",\"modelRef\":\"coder-default\",\"maxTokens\":24}" \
    --max-time 180 | head -c 2000
}

echo "=== TEST1 expect GPU ==="
# wait health
for i in $(seq 1 12); do
  snap=$(curl -sS "${AUTH[@]}" "$API/superadmin/ai/inference")
  pref=$(echo "$snap" | python3 -c 'import json,sys; d=json.load(sys.stdin); x=d.get("data",d); print(x.get("currentPreferred"))')
  [[ "$pref" == "laptop-gpu" ]] && break
  sleep 5
done
[[ "$pref" == "laptop-gpu" ]] && pass TEST1_GPU_PRIORITY "preferred=$pref" || fail TEST1_GPU_PRIORITY "preferred=$pref"
echo "$snap" > /tmp/hybrid-test1-snap.json

echo "DONE_PARTIAL"
python3 - <<PY
import json
print(json.dumps({"results":[${results[*]}]}, indent=2))
PY
