# Phase 3 Quick Start Guide

## 🚀 Running the Service

### 1. Start Infrastructure
```bash
docker compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)

### 2. Run the Service
```bash
# Option 1: Run directly with Go
go run ./cmd/server/main.go

# Option 2: Use the Makefile
make run

# Option 3: Use the compiled binary
./bin/buzz-service.exe  # Windows
./bin/buzz-service      # Linux/Mac
```

The service will:
- Load configuration from `.env` file
- Connect to PostgreSQL
- Run database migrations automatically
- Start HTTP server on port 8080

### 3. Test the Service
```bash
# Health check (no auth required)
curl http://localhost:8080/health

# Run full test suite
.\test_phase3.ps1  # Windows
bash test_phase3.sh  # Linux/Mac
```

## 🔑 Test API Key

**Key:** `buzz_test_key_123`

**Usage:**
```bash
curl -H "Authorization: Bearer buzz_test_key_123" http://localhost:8080/api/v1/notifications
```

**Scopes:**
- `notification:send` - Send notifications
- `notification:read` - Read notifications
- `template:read` - Read templates
- `template:write` - Create/update templates
- `batch:read` - Read batches
- `batch:write` - Create batches

## 📝 Quick Examples

### Send Email Notification
```bash
curl -X POST http://localhost:8080/api/v1/notifications \
  -H "Authorization: Bearer buzz_test_key_123" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "channel": "email",
    "subject": "Hello from Buzz!",
    "body": "This is a test notification.",
    "priority": "normal"
  }'
```

### Send SMS
```bash
curl -X POST http://localhost:8080/api/v1/notifications \
  -H "Authorization: Bearer buzz_test_key_123" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "channel": "sms",
    "body": "Your code is 123456",
    "priority": "high"
  }'
```

### Use Template
```bash
curl -X POST http://localhost:8080/api/v1/notifications \
  -H "Authorization: Bearer buzz_test_key_123" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "channel": "email",
    "template": "Welcome Email",
    "data": {
      "name": "John Doe",
      "app_name": "My App",
      "verification_link": "https://example.com/verify/123"
    }
  }'
```

### List Notifications
```bash
# All notifications
curl -H "Authorization: Bearer buzz_test_key_123" \
  "http://localhost:8080/api/v1/notifications?limit=10"

# Filter by channel
curl -H "Authorization: Bearer buzz_test_key_123" \
  "http://localhost:8080/api/v1/notifications?channel=email&limit=5"

# Filter by status
curl -H "Authorization: Bearer buzz_test_key_123" \
  "http://localhost:8080/api/v1/notifications?status=queued"
```

### Get Notification Details
```bash
curl -H "Authorization: Bearer buzz_test_key_123" \
  "http://localhost:8080/api/v1/notifications/550e8400-e29b-41d4-a716-446655440000"
```

### Create Template
```bash
curl -X POST http://localhost:8080/api/v1/templates \
  -H "Authorization: Bearer buzz_test_key_123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "password_reset",
    "channel": "email",
    "subject": "Reset Your Password",
    "body": "Hi {{name}}, click here to reset: {{reset_link}}"
  }'
```

### List Templates
```bash
# All templates
curl -H "Authorization: Bearer buzz_test_key_123" \
  "http://localhost:8080/api/v1/templates"

# Only active templates
curl -H "Authorization: Bearer buzz_test_key_123" \
  "http://localhost:8080/api/v1/templates?active=true"

# Filter by channel
curl -H "Authorization: Bearer buzz_test_key_123" \
  "http://localhost:8080/api/v1/templates?channel=email"
```

### Get Template
```bash
curl -H "Authorization: Bearer buzz_test_key_123" \
  "http://localhost:8080/api/v1/templates/Welcome%20Email"
```

### Update Template
```bash
curl -X PATCH "http://localhost:8080/api/v1/templates/password_reset" \
  -H "Authorization: Bearer buzz_test_key_123" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "URGENT: Reset Your Password",
    "active": true
  }'
```

## 🐛 Troubleshooting

### Database Connection Failed
**Error:** "Failed to connect to database"
**Fix:** Ensure PostgreSQL is running: `docker compose ps`

### Migration Failed
**Error:** "Failed to run migrations"
**Fix:** 
1. Check database is accessible
2. Verify credentials in `.env`
3. Check migrations in `internal/store/migrations/`

### Invalid API Key
**Error:** "invalid api key"
**Fix:**
1. Ensure you're using: `buzz_test_key_123`
2. Check Authorization header format: `Bearer buzz_test_key_123`
3. Verify seed data was loaded (check `api_keys` table)

### Template Not Found
**Error:** "template not found"
**Fix:**
1. List templates: `GET /api/v1/templates`
2. Check template name is exact match
3. Verify seed data loaded: `SELECT * FROM templates;`

## 📊 Database Access

### Connect to PostgreSQL
```bash
# Using docker
docker exec -it buzz-postgres psql -U buzz_user -d buzz_service

# Directly
psql -h localhost -U buzz_user -d buzz_service
```

### Useful Queries
```sql
-- Check notifications
SELECT id, channel, status, created_at FROM notifications ORDER BY created_at DESC LIMIT 10;

-- Check templates
SELECT name, channels, is_active FROM templates;

-- Check API keys
SELECT name, key_prefix, scopes, is_active FROM api_keys;

-- Count notifications by status
SELECT status, COUNT(*) FROM notifications GROUP BY status;
```

## 🔧 Environment Variables

Key variables in `.env`:
```env
SERVER_PORT=8080
DB_HOST=localhost
DB_PORT=5432
DB_NAME=buzz_service
DB_USER=buzz_user
DB_PASSWORD=secure_password
LOG_LEVEL=info
```

## 📈 Next Steps

After Phase 3, proceed to:
- **Phase 4:** Queue integration (Redis + Asynq)
- **Phase 5:** Provider integrations (SendGrid, Twilio, FCM)
- **Phase 6:** Batch operations
- **Phase 7:** Rate limiting
- **Phase 8:** Webhooks

## 📚 API Documentation

Full OpenAPI spec (coming in Phase 4): `/docs/openapi.yaml`

For now, refer to:
- `phase3-summary.md` - Complete implementation details
- `test_phase3.ps1` / `test_phase3.sh` - Working examples
