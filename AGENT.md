# Buzz Notification Service — Agent Guide

A unified notification delivery platform supporting email, SMS, push, and in-app messaging. Provider credentials live in the database; no per-channel environment variables.

---

## Quick Facts

| Aspect | Detail |
|--------|--------|
| Language | Go 1.21+ |
| HTTP framework | Fiber v2 |
| Database | PostgreSQL 15 |
| Queue | Redis + Asynq |
| Real-time | Server-Sent Events (SSE) via Redis Pub/Sub |
| API docs | Swagger UI at `/swagger/` |
| Client app | Next.js 15 at `client/` (port 3000) |

---

## Architecture

```
HTTP Request
    ↓
internal/api/          — Fiber handlers, auth middleware, validation
    ↓
internal/queue/        — Asynq producer → Redis
    ↓
internal/queue/worker  — Processes jobs, calls Registry.Resolve()
    ↓
internal/provider/     — Registry → per-channel provider (email/sms/push/inapp)
    ↓
internal/store/        — PostgreSQL reads/writes
    ↓
External services      — SES, SMTP, Twilio, NotifyLK, FCM
```

---

## Key Packages

### `internal/api/`

| File | Purpose |
|------|---------|
| `notifications.go` | `POST /api/v1/notifications` — send, enqueue, SSE publish |
| `providers.go` | CRUD for `provider_configs` table |
| `datasources.go` | CRUD for external batch data sources |
| `batch.go` | Bulk send endpoints |
| `templates.go` | Template CRUD |
| `inbox.go` | In-app inbox endpoints |
| `devices.go` | Push device token registration |
| `webhooks.go` | Inbound provider webhooks |
| `routes.go` | All route registrations — `SetupRoutes(app, db, producer, cfg, gateway, registry)` |
| `validation.go` | All request structs and validators |
| `middleware.go` | API key auth, `RequireScope` |

### `internal/provider/`

| File | Purpose |
|------|---------|
| `registry.go` | Loads provider configs from DB at startup; `Resolve(channel, name)` at delivery time |
| `provider.go` | `Provider` interface: `Send(ctx, *Notification) error` |
| `factory.go` | Legacy helpers (env-based init, kept for reference) |
| `email/` | SES + SMTP implementations + rate limiter |
| `sms/` | Twilio + NotifyLK + router |
| `push/fcm.go` | Firebase Cloud Messaging |
| `inapp/` | Database-backed in-app delivery |
| `mock/` | No-op provider for tests |

**Important:** Provider credentials are **not** in `.env`. They are stored in the `provider_configs` table (JSONB `config` column) and loaded at startup via `Registry.Reload()`. The registry is reloaded automatically after any CRUD operation on `/api/v1/providers`.

### `internal/queue/`

| File | Purpose |
|------|---------|
| `producer.go` | Enqueues `TypeNotification` and `TypeBatchProcess` Asynq tasks |
| `worker.go` | `HandleNotification` — resolves provider via registry, calls `Send`, updates status |

### `internal/realtime/`

SSE gateway backed by Redis Pub/Sub. Clients connect to `GET /api/v1/stream` with `X-User-ID` header. When a notification is enqueued for an in-app channel (or has a `recipient_id`), `gateway.PublishInboxUpdate(userID)` fires a `user:<id>` Redis message, which the client uses to invalidate and re-fetch the inbox.

`GET /api/v1/stream/stats` returns `{ online_users, total_connections }`.

### `internal/batch/`

`processor.go` fetches recipients from the registered datasource, creates individual notification records, and enqueues them. Supports `pagination_style: "offset"` (default) and `"page"`.

### `internal/store/`

All PostgreSQL access. `migrations.go` applies numbered SQL files from `store/migrations/` on startup.

Tables: `notifications`, `batches`, `templates`, `inbox`, `device_tokens`, `datasources`, `provider_configs`, `api_keys`, `schema_migrations`.

---

## Provider Config Shape

```json
POST /api/v1/providers
{
  "name": "ses-main",
  "channel": "email",
  "provider": "ses",
  "config": {
    "from_email": "noreply@example.com",
    "from_name": "My App",
    "region": "us-east-1",
    "rate_limit_rps": 14
  },
  "is_default": true
}
```

Supported provider types: `ses`, `smtp` (email) · `twilio`, `notifylk` (sms) · `fcm` (push).

---

## Sending a Notification

```bash
# Omit "provider" to use the channel default
curl -X POST http://localhost:8080/api/v1/notifications \
  -H "Authorization: Bearer buzz_test_key_123" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "channel": "email",
    "subject": "Hello",
    "body": "World",
    "provider": "ses-main"   # optional: pick a specific provider by name
  }'
```

---

## Environment Variables

Only infrastructure variables — provider credentials are in the DB.

| Group | Key variables |
|-------|--------------|
| Server | `SERVER_PORT`, `SERVER_HOST`, `ENV` |
| Database | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| Queue | `QUEUE_CONCURRENCY`, `QUEUE_*_WEIGHT` |
| Logging | `LOG_LEVEL`, `LOG_FORMAT` |

---

## Local Development

```bash
# Start PostgreSQL + Redis
docker-compose up -d

# Start API (hot reload)
air -c .air.toml

# Start client app
cd client && npm run dev

# Run tests
go test ./...

# Regenerate Swagger docs after handler changes
make swagger
```

---

## Client App (`client/`)

Next.js 15 App Router application. Pages:

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — health, notification matrix, online users |
| `/notifications` | Send form + list |
| `/stream` | Live SSE event feed |
| `/inbox` | In-app inbox (SSE auto-refresh) |
| `/templates` | Template CRUD |
| `/devices` | Push device registration |
| `/batches` | Bulk send + progress |
| `/datasources` | External API source CRUD |
| `/providers` | Provider config CRUD |
| `/docs` | Integration documentation |
| `/settings` | API URL, key, user ID |

The client reads config from `localStorage` keys `buzz_api_url`, `buzz_api_key`, `buzz_user_id`.

> See `client/AGENTS.md` for Next.js 15-specific notes before editing frontend code.

---

## Adding a New Provider Type

1. Implement `Provider` interface in `internal/provider/<channel>/`
2. Add a case to `buildProvider()` in `internal/provider/registry.go`
3. Document the expected `config` keys in the client's `CONFIG_TEMPLATES` map (`client/src/app/providers/page.tsx`)

---

## Common Queries

```sql
-- Recent failures
SELECT id, channel, error_message FROM notifications
WHERE status = 'failed' ORDER BY failed_at DESC LIMIT 20;

-- Active providers per channel
SELECT name, channel, provider, is_default FROM provider_configs
WHERE is_active = true ORDER BY channel, is_default DESC;

-- Online users (approximate, SSE connections are in memory)
SELECT COUNT(DISTINCT user_id) FROM notifications
WHERE created_at > now() - interval '5 minutes';
```

---

*Buzz Notification Service v1.0.0*
