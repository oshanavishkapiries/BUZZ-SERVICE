# Project Overview — Buzz Notification Service

A unified notification delivery platform supporting email, SMS, push, and in-app messaging.

## Tech Stack

- **Backend:** Go + Fiber v2
- **Database:** PostgreSQL 15
- **Queue:** Redis + Asynq
- **Real-time:** SSE via Redis Pub/Sub
- **Frontend:** Next.js 15 (`client/`)

## Key Concept

Provider credentials are stored in the database (`provider_configs` table), not in `.env`. This allows dynamic provider management via API.

## Structure

- `cmd/server/` — Entry point
- `internal/api/` — HTTP handlers and routes
- `internal/provider/` — Channel providers (email/sms/push/inapp)
- `internal/queue/` — Asynq job processing
- `internal/store/` — PostgreSQL access and migrations
- `internal/realtime/` — SSE gateway
- `internal/batch/` — Bulk notification processing
- `client/` — Next.js dashboard

## Quick Start

```bash
docker-compose up -d
air -c .air.toml
cd client && npm run dev
```

For detailed implementation, read `agent/current-implementation.md` or the source files directly.
