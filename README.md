```
 ██████╗ ██╗   ██╗███████╗███████╗
 ██╔══██╗██║   ██║╚══███╔╝╚══███╔╝
 ██████╔╝██║   ██║  ███╔╝   ███╔╝
 ██╔══██╗██║   ██║ ███╔╝   ███╔╝
 ██████╔╝╚██████╔╝███████╗███████╗
 ╚═════╝  ╚═════╝ ╚══════╝╚══════╝

 Buzz Notification Service  |  v1.0.0
 Unified Multi-Channel Notification Delivery
```

---

# Buzz Notification Service

A unified, high-performance notification delivery service supporting email, SMS, push notifications, and in-app messaging. Built for reliability, scalability, and developer ergonomics.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Development Setup](#development-setup)
- [API Documentation](#api-documentation)
- [Admin Panel](#admin-panel)
- [Database Schema](#database-schema)
- [Queue System](#queue-system)
- [Security](#security)
- [Environment Variables](#environment-variables)
- [Docker Reference](#docker-reference)

---

## Overview

Buzz provides a single, consistent interface for sending notifications across multiple delivery channels. It abstracts provider-specific implementation details behind a clean REST API, handles delivery queuing and retries internally, and exposes real-time status through Server-Sent Events and queue monitoring endpoints.

---

## Features

| Feature | Description |
|---|---|
| Multi-channel delivery | Email, SMS, push notifications, and in-app messaging through a unified API |
| Bulk notifications | Send to multiple recipients via external datasources with progress tracking |
| Real-time delivery | Server-Sent Events (SSE) for instant in-app notification streaming |
| Template management | Create and reuse notification templates with variable substitution |
| Delivery tracking | Monitor notification status and access delivery analytics |
| Queue monitoring | Real-time queue statistics and worker performance monitoring |
| Request deduplication | Idempotency keys for safe and reliable bulk operations |

---

## Development Setup

### Prerequisites

- Go 1.21+
- Docker and Docker Compose
- Git

---

### Step 1 — Install Dependencies

```bash
cd /workspaces/BUZZ-SERVICE
go mod download
go mod tidy
```

---

### Step 2 — Start Infrastructure Services

```bash
docker-compose up -d
```

This will provision the following services:

| Service | Version | Port | Details |
|---|---|---|---|
| PostgreSQL | 15 | 5432 | Database: `buzz_service`, User: `buzz_user` |
| Redis | 7 | 6379 | Task queue backend |
| Application | latest | 8080 | REST API server |

Verify all services are healthy:

```bash
docker-compose ps
```

---

### Step 3 — Start the Development Server

The project uses `air` for hot reload during development. On file change, the server will automatically rebuild and restart.

```bash
# Install air (first time only)
go install github.com/air-verse/air@latest

# Start development server
air -c .air.toml
```

Build errors are written to `build-errors.log` in the project root.

---

### Step 4 — Verify the Setup

```bash
curl http://localhost:8080/health
```

Expected response:

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "checks": { "database": "up" }
}
```

---

### Environment Configuration

Copy the example environment file and adjust values as needed:

```bash
cp .env.example .env
```

Key configuration groups:

| Group | Variables |
|---|---|
| Server | `SERVER_PORT`, `SERVER_HOST`, `ENV` |
| Database | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` |
| Redis | `REDIS_HOST`, `REDIS_PORT` |
| Email | `EMAIL_PROVIDER` — `smtp` or `ses` |
| SMS | `SMS_PROVIDER` — `notifylk`, `twilio`, or `router` |
| Push | `FCM_CREDENTIALS_FILE` |

See the full reference in the [Environment Variables](#environment-variables) section.

---

## API Documentation

All API documentation is served live by the application via **Swagger UI**. There are no separate spec files to maintain — the docs are generated from the source code annotations and stay in sync automatically.

### Accessing Swagger UI

```
http://localhost:8080/swagger/
```

The Swagger UI provides:

- Live request execution against the running server
- Full schema documentation for all request and response models
- Authentication configuration for protected endpoints
- Downloadable OpenAPI specification (`/swagger/doc.json`)

### Authentication in Swagger UI

Click the **Authorize** button in the top-right corner and enter your key:

```
Bearer buzz_test_key_123
```

All subsequent requests from the UI will include the header automatically.

### Keeping Docs in Sync

When you add or modify an API endpoint, regenerate the swagger docs:

```bash
make swagger
```

This runs `swag init` and updates the files under `docs/`. Commit the updated `docs/` alongside your handler changes.

---

## Database Schema

Migrations run automatically on application startup. The following tables are managed by the service:

| Table | Purpose |
|---|---|
| `notifications` | Notification records with full status tracking |
| `batches` | Bulk notification batch metadata and progress |
| `templates` | Reusable notification message templates |
| `inbox` | In-app notification storage per recipient |
| `device_tokens` | Push notification device registrations |
| `datasources` | External data sources used for bulk operations |
| `api_keys` | API key management with scope definitions |
| `schema_migrations` | Applied migration tracking |

### Accessing the Database Directly

```bash
docker exec -it buzz-postgres psql -U buzz_user -d buzz_service
```

Useful `psql` commands:

```sql
-- List all tables
\dt

-- Inspect a specific table
\d notifications

-- Exit
\q
```

### Reset the Database

```bash
# Remove containers and all associated volumes
docker-compose down -v

# Reprovision from scratch
docker-compose up -d
```

---

## Queue System

Buzz uses **Asynq**, a Redis-backed distributed task queue, for all asynchronous delivery operations.

### Managed Queues

| Queue | Purpose |
|---|---|
| `email` | Outbound email delivery tasks |
| `sms` | Outbound SMS delivery tasks |
| `push` | Push notification dispatch tasks |
| `inapp` | In-app message delivery tasks |
| `batch` | Bulk batch processing and coordination |

### Monitoring Queues

```bash
# All queues
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:8080/api/v1/monitoring/queues

# Specific queue
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:8080/api/v1/monitoring/queues/email
```

---

## Security

| Control | Implementation |
|---|---|
| Authentication | API key-based Bearer token authentication |
| Authorization | Role-based access control (RBAC) with configurable scopes |
| CORS | Enabled for cross-origin browser clients |
| Audit logging | Request ID tracking on all inbound requests |
| Injection prevention | Parameterized queries throughout the data layer |

---

## Environment Variables

```env
# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------
SERVER_PORT=8080
SERVER_HOST=0.0.0.0
ENV=development

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DB_HOST=localhost
DB_PORT=5432
DB_NAME=buzz_service
DB_USER=buzz_user
DB_PASSWORD=secure_password

# ---------------------------------------------------------------------------
# Redis
# ---------------------------------------------------------------------------
REDIS_HOST=localhost
REDIS_PORT=6379

# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
EMAIL_PROVIDER=smtp        # smtp | ses
EMAIL_FROM=noreply@buzz.local

# ---------------------------------------------------------------------------
# SMS
# ---------------------------------------------------------------------------
SMS_PROVIDER=router        # notifylk | twilio | router

# ---------------------------------------------------------------------------
# Push Notifications
# ---------------------------------------------------------------------------
FCM_CREDENTIALS_FILE=

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_LEVEL=info             # debug | info | warn | error
LOG_FORMAT=json            # json | text
```

For the complete list of available variables, refer to `.env.example`.

---

## Docker Reference

### Service Management

```bash
# Start all services in the background
docker-compose up -d

# Stop services, preserve volumes
docker-compose down

# Stop services, remove volumes and data
docker-compose down -v

# Rebuild images without cache
docker-compose build --no-cache

# Restart a specific service
docker-compose restart buzz-service
```

### Logs

```bash
# Stream logs from all services
docker-compose logs -f

# Stream logs from a specific service
docker-compose logs -f buzz-service
docker-compose logs -f buzz-postgres
docker-compose logs -f buzz-redis
```

### Status

```bash
docker-compose ps
```

### Building the Production Binary

```bash
CGO_ENABLED=0 GOOS=linux go build \
  -a -installsuffix cgo \
  -o buzz-service \
  ./cmd/server
```

### Building and Running the Docker Image

```bash
docker build -t buzz-service:latest .
docker run -p 8080:8080 buzz-service:latest
```

---

### Running Tests

```bash
# Run all tests
go test ./...

# Run with verbose output
go test -v ./...

# Run tests for a specific package
go test -v ./internal/api
```

---

*Buzz Notification Service v1.0.0*
