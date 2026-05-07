# Current Implementation — Buzz Notification Service

> This file describes the current state of the codebase. Update it after any significant code change.

---

## Overview

Buzz Notification Service is a unified notification delivery platform. It supports multiple channels (email, SMS, push, in-app) with provider credentials stored in the database for dynamic management.

---

## Backend (`/` root)

### Entry Point
- `cmd/server/main.go` — Application bootstrap: config loading, DB connection, Redis setup, route registration, queue worker startup

### API Layer (`internal/api/`)
- **Routes** — All routes defined in `routes.go`, registered via `SetupRoutes()`
- **Handlers:**
  - `notifications.go` — `POST /api/v1/notifications` (send single notification)
  - `providers.go` — CRUD for provider configurations
  - `templates.go` — CRUD for notification templates
  - `datasources.go` — CRUD for external batch data sources
  - `batch.go` — Bulk notification endpoints
  - `inbox.go` — In-app inbox endpoints
  - `devices.go` — Push device token registration
  - `webhooks.go` — Inbound provider webhooks (delivery status callbacks)
- **Middleware** — `middleware.go`: API key auth, scope-based access control
- **Validation** — `validation.go`: Request structs and validators

### Provider System (`internal/provider/`)
- **Registry** — `registry.go`: Loads provider configs from DB at startup; `Resolve(channel, name)` at delivery time
- **Interface** — `provider.go`: `Send(ctx, *Notification) error`
- **Channels:**
  - `email/` — SES and SMTP providers with rate limiting and HTML templates
  - `sms/` — Twilio and NotifyLK (TextLK) providers with router and rate limiting
  - `push/` — Firebase Cloud Messaging (FCM) with single and multicast support
  - `inapp/` — Database-backed in-app notification delivery
  - `mock/` — No-op provider for testing

### Queue System (`internal/queue/`)
- `producer.go` — Enqueues `TypeNotification` and `TypeBatchProcess` Asynq tasks
- `worker.go` — Processes jobs: resolves provider via registry, calls `Send()`, updates status
- `inspector.go` — Queue inspection utilities
- `deadletter.go` — Dead letter queue handling

### Real-time (`internal/realtime/`)
- `gateway.go` — SSE gateway backed by Redis Pub/Sub
- `connection.go` — Connection management for SSE clients
- Endpoints: `GET /api/v1/stream` (SSE), `GET /api/v1/stream/stats`

### Batch Processing (`internal/batch/`)
- `processor.go` — Fetches recipients from registered datasource, creates individual notifications, enqueues them
- Supports `pagination_style: "offset"` and `"page"`

### Data Store (`internal/store/`)
- `postgres.go` — Database connection pool
- `migrations.go` — Applies numbered SQL migrations on startup
- **Tables:** `notifications`, `batches`, `templates`, `inbox`, `device_tokens`, `datasources`, `provider_configs`, `api_keys`, `schema_migrations`
- **Domain models** — `internal/domain/models.go`

### Configuration (`internal/config/`)
- `config.go` — Environment-based configuration (server, DB, Redis, queue, logging)

### Logging (`pkg/logger/`)
- `logger.go` — Structured logging setup

---

## Frontend (`client/`)

Next.js 15 App Router application running on port 3000.

### Pages
| Route | Purpose |
|-------|---------|
| `/` | Dashboard — health, notification matrix, online users |
| `/notifications` | Send form + list |
| `/stream` | Live SSE event feed |
| `/inbox` | In-app inbox with SSE auto-refresh |
| `/templates` | Template CRUD |
| `/devices` | Push device registration |
| `/batches` | Bulk send with progress tracking |
| `/datasources` | External API source CRUD |
| `/providers` | Provider config CRUD |
| `/docs` | Integration documentation |
| `/settings` | API URL, key, user ID configuration |

### Configuration
- Reads from `localStorage`: `buzz_api_url`, `buzz_api_key`, `buzz_user_id`

---

## API Endpoints Summary

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/notifications` | Send notification |
| GET | `/api/v1/notifications` | List notifications |
| GET | `/api/v1/notifications/:id` | Get notification |
| POST | `/api/v1/providers` | Create provider |
| GET | `/api/v1/providers` | List providers |
| PUT | `/api/v1/providers/:id` | Update provider |
| DELETE | `/api/v1/providers/:id` | Delete provider |
| POST | `/api/v1/templates` | Create template |
| GET | `/api/v1/templates` | List templates |
| PUT | `/api/v1/templates/:id` | Update template |
| DELETE | `/api/v1/templates/:id` | Delete template |
| POST | `/api/v1/datasources` | Create datasource |
| GET | `/api/v1/datasources` | List datasources |
| POST | `/api/v1/batches` | Create batch |
| GET | `/api/v1/batches/:id` | Get batch status |
| GET | `/api/v1/stream` | SSE connection |
| GET | `/api/v1/stream/stats` | Stream statistics |
| GET | `/api/v1/inbox/:user_id` | Get inbox |
| POST | `/api/v1/devices` | Register device token |
| GET | `/swagger/` | Swagger UI |

---

## Provider Types

| Channel | Provider | Config Keys |
|---------|----------|-------------|
| email | ses | `from_email`, `from_name`, `region`, `rate_limit_rps` |
| email | smtp | `host`, `port`, `username`, `password`, `from_email`, `from_name`, `tls`, `rate_limit_rps` |
| sms | twilio | `account_sid`, `auth_token`, `from_number`, `rate_limit_rps` |
| sms | notifylk | `api_key`, `from_sender`, `rate_limit_rps` |
| push | fcm | `project_id`, `credentials_json` |

---

*Last updated: 2026-05-07*
