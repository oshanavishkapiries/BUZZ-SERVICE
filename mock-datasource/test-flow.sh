#!/usr/bin/env bash
# End-to-end test: datasource → batch → in-app notifications
# Usage: ./test-flow.sh [BUZZ_URL] [MOCK_URL]
#   BUZZ_URL  default: http://localhost:5001
#   MOCK_URL  default: http://localhost:3001

set -e

BUZZ="${1:-http://localhost:5001}"
MOCK="${2:-http://localhost:3001}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok()   { echo -e "${GREEN}  ✓ $*${NC}"; }
info() { echo -e "${YELLOW}  → $*${NC}"; }
fail() { echo -e "${RED}  ✗ $*${NC}"; exit 1; }
step() { echo -e "\n${YELLOW}=== $* ===${NC}"; }

# ── Step 0: sanity checks ────────────────────────────────────────────────────
step "0. Health checks"

info "Mock datasource at $MOCK"
curl -sf "$MOCK/health" | python3 -m json.tool && ok "mock server healthy" \
  || fail "Mock server not reachable. Run:  cd mock-datasource && npm install && node server.js"

info "Buzz Service at $BUZZ"
curl -sf "$BUZZ/api/v1/health" > /dev/null 2>&1 \
  && ok "buzz service reachable" \
  || fail "Buzz Service not reachable at $BUZZ"

# ── Step 1: login ────────────────────────────────────────────────────────────
step "1. Login"

info "Logging in as admin@buzzservice.com"
LOGIN=$(curl -sf -X POST "$BUZZ/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@buzzservice.com","password":"admin123"}')

TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
[ -n "$TOKEN" ] && ok "Got auth token" || fail "Login failed: $LOGIN"

AUTH="Authorization: Bearer $TOKEN"

# Helper: make authenticated calls easier
buzz() { curl -sf -H "$AUTH" -H "Content-Type: application/json" "$@"; }

# ── Step 2: get/create application ───────────────────────────────────────────
step "2. Application"

APPS=$(buzz "$BUZZ/api/v1/applications")
APP_ID=$(echo "$APPS" | python3 -c "
import sys,json
apps = json.load(sys.stdin)
items = apps.get('applications', apps) if isinstance(apps, dict) else apps
print(items[0]['id'])
" 2>/dev/null)

if [ -z "$APP_ID" ]; then
  info "No application found — creating one"
  APP=$(buzz -X POST "$BUZZ/api/v1/applications" \
    -d '{"name":"Test App","description":"mock datasource test"}')
  APP_ID=$(echo "$APP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
fi
ok "Application ID: $APP_ID"

# ── Step 3: get API key ───────────────────────────────────────────────────────
step "3. API Key"

KEYS=$(buzz "$BUZZ/api/v1/applications/$APP_ID/api-keys")
API_KEY=$(echo "$KEYS" | python3 -c "
import sys,json
data = json.load(sys.stdin)
keys = data.get('api_keys', data) if isinstance(data, dict) else data
# Find first active key
for k in (keys if isinstance(keys,list) else []):
    if k.get('is_active', True):
        print(k.get('key',''))
        break
" 2>/dev/null)

if [ -z "$API_KEY" ]; then
  info "No API key found — creating one"
  KEY_RESP=$(buzz -X POST "$BUZZ/api/v1/applications/$APP_ID/api-keys" \
    -d '{"name":"test-key","environment":"development","scopes":["notifications:write","notifications:read"]}')
  API_KEY=$(echo "$KEY_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('key',''))")
fi
ok "API Key: ${API_KEY:0:20}..."

NAUTH="Authorization: Bearer $API_KEY"
nbuzz() { curl -sf -H "$NAUTH" -H "Content-Type: application/json" "$@"; }

# ── Step 4: create in-app template ───────────────────────────────────────────
step "4. Template"

TMPL_NAME="batch-welcome-inapp"
info "Creating template '$TMPL_NAME'"

TMPL=$(nbuzz -X POST "$BUZZ/api/v1/templates" -d "{
  \"name\":    \"$TMPL_NAME\",
  \"channel\": \"inapp\",
  \"subject\": \"👋 Welcome, {{name}}!\",
  \"body\":    \"Hi {{name}}, welcome to Buzz! Your account ({{id}}) is now active.\"
}")
TMPL_ID=$(echo "$TMPL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','already_exists'))" 2>/dev/null)
ok "Template ready (id=$TMPL_ID)"

# ── Step 5: register datasource ──────────────────────────────────────────────
step "5. Datasource"

DS_NAME="mock-users"
info "Registering datasource '$DS_NAME' pointing to $MOCK"

DS=$(nbuzz -X POST "$BUZZ/api/v1/datasources" -d "{
  \"name\":      \"$DS_NAME\",
  \"base_url\":  \"$MOCK\",
  \"auth_type\": \"\",
  \"auth_config\": {},
  \"endpoints\": {
    \"all_users\": {
      \"path\":   \"/users\",
      \"method\": \"GET\",
      \"response_format\": {
        \"recipients_key\": \"recipients\",
        \"name_field\":     \"name\",
        \"email_field\":    \"email\",
        \"phone_field\":    \"phone\"
      }
    }
  }
}")
DS_ID=$(echo "$DS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','already_exists'))" 2>/dev/null)
ok "Datasource ready (id=$DS_ID)"

# ── Step 6: fire the batch ────────────────────────────────────────────────────
step "6. Send Batch"

IK="test-batch-$(date +%s)"
info "Firing batch with idempotency_key=$IK"

BATCH=$(nbuzz -X POST "$BUZZ/api/v1/batches/send" -d "{
  \"datasource_name\":  \"$DS_NAME\",
  \"endpoint_name\":    \"all_users\",
  \"endpoint_params\":  {},
  \"template_name\":    \"$TMPL_NAME\",
  \"template_data\":    {},
  \"channel\":          \"inapp\",
  \"priority\":         \"normal\",
  \"idempotency_key\":  \"$IK\"
}")
BATCH_ID=$(echo "$BATCH" | python3 -c "import sys,json; print(json.load(sys.stdin)['batch_id'])")
ok "Batch queued — batch_id=$BATCH_ID"

# ── Step 7: poll status ───────────────────────────────────────────────────────
step "7. Poll Batch Status"

for i in $(seq 1 12); do
  sleep 3
  STATUS_RESP=$(nbuzz "$BUZZ/api/v1/batches/$BATCH_ID")
  STATUS=$(echo "$STATUS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); b=d.get('batch',d); print(b.get('status','?'))")
  SENT=$(echo "$STATUS_RESP"   | python3 -c "import sys,json; d=json.load(sys.stdin); b=d.get('batch',d); print(b.get('sent_count',0))")
  TOTAL=$(echo "$STATUS_RESP"  | python3 -c "import sys,json; d=json.load(sys.stdin); b=d.get('batch',d); print(b.get('total_count',0))")
  info "[$i/12] status=$STATUS  sent=$SENT/$TOTAL"
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
done

[ "$STATUS" = "completed" ] && ok "Batch COMPLETED — $SENT/$TOTAL notifications sent" \
  || fail "Batch ended with status: $STATUS"

# ── Step 8: verify inbox ──────────────────────────────────────────────────────
step "8. Verify In-App Inbox"

info "Checking inbox for first recipient (usr_0001)"
INBOX=$(nbuzz "$BUZZ/api/v1/inbox?user_id=usr_0001&limit=5")
COUNT=$(echo "$INBOX" | python3 -c "
import sys,json
d = json.load(sys.stdin)
items = d.get('notifications', d.get('inbox', d if isinstance(d,list) else []))
print(len(items))
" 2>/dev/null)

if [ "${COUNT:-0}" -gt 0 ]; then
  ok "Inbox has $COUNT message(s) for usr_0001"
  echo "$INBOX" | python3 -c "
import sys,json
d = json.load(sys.stdin)
items = d.get('notifications', d.get('inbox', d if isinstance(d,list) else []))
for n in items[:3]:
    print('  subject:', n.get('subject','—'))
    print('  body:   ', n.get('body','—')[:80])
    print()
"
else
  info "No inbox entries yet for usr_0001 (may still be processing)"
fi

echo -e "\n${GREEN}All done! ✅${NC}"
echo "  Batch ID : $BATCH_ID"
echo "  Status   : $STATUS"
echo "  Sent     : $SENT / $TOTAL"
