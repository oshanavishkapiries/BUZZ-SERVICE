```
 ██████╗ ██╗   ██╗███████╗███████╗
 ██╔══██╗██║   ██║╚══███╔╝╚══███╔╝
 ██████╔╝██║   ██║  ███╔╝   ███╔╝
 ██╔══██╗██║   ██║ ███╔╝   ███╔╝
 ██████╔╝╚██████╔╝███████╗███████╗
 ╚═════╝  ╚═════╝ ╚══════╝╚══════╝

 Buzz Notification Service  |  v1.0.0
```

A unified notification delivery service supporting email, SMS, push, and in-app messaging. Provider credentials are stored in the database — no environment-level secrets per channel.

---

## Quick Start

**1. Start infrastructure**

```bash
docker-compose up -d
```

**2. Start the API server**

```bash
# Install air (first time only)
go install github.com/air-verse/air@latest

air -c .air.toml
```

**3. Start the client app**

```bash
cd client
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — configure your API URL and key in **Settings**, then use the **Docs** page for full integration guidance.

**4. Health check**

```bash
curl http://localhost:8080/health
```

---

## What's Running

| Service | URL | Purpose |
|---------|-----|---------|
| API | `http://localhost:8080` | REST API + SSE |
| Swagger UI | `http://localhost:8080/swagger/` | Live API docs |
| Client App | `http://localhost:3000` | Testing UI + Docs |
| PostgreSQL | `localhost:5432` | Primary database |
| Redis | `localhost:6379` | Queue + real-time pub/sub |

---

## Authentication

All `/api/v1/*` endpoints require a Bearer token header:

```
Authorization: Bearer buzz_test_key_123
```

A test key with full scopes is seeded on first run. Manage keys directly in the database or via the API.

---

## Provider Configuration

Email, SMS, and push credentials are stored in the `provider_configs` table — not in environment files. Add providers via the **Providers** page in the client app or directly via the API:

```
POST /api/v1/providers
```

See the client app **Docs** page for the full configuration reference per provider type (ses, smtp, twilio, notifylk, fcm).

---

## Environment Variables

Copy and edit the example file:

```bash
cp .env.example .env
```

Only infrastructure variables are required. See `.env.example` for the full list.

---

## Database

Migrations run automatically on startup.

```bash
# Access the database
docker exec -it buzz-postgres psql -U buzz_user -d buzz_service

# Reset everything
docker-compose down -v && docker-compose up -d
```

---

## Key Tables

| Table | Purpose |
|-------|---------|
| `notifications` | Individual delivery records |
| `batches` | Bulk send jobs and progress |
| `templates` | Reusable message templates |
| `inbox` | In-app messages per user |
| `device_tokens` | Push device registrations |
| `datasources` | External APIs for batch recipient fetch |
| `provider_configs` | Email/SMS/push provider credentials |
| `api_keys` | Authentication keys and scopes |

---

## Update Swagger Docs

After modifying any endpoint handler:

```bash
make swagger
```

---

*Buzz Notification Service v1.0.0*
