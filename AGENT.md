# BUZZ Notification Service - Agent Guide

> A unified, high-performance notification delivery service supporting email, SMS, push notifications, and in-app messaging. Built for reliability, scalability, and developer ergonomics.

---

## Quick Facts

| Aspect | Details |
|--------|---------|
| **Language** | Go 1.26.1 |
| **Framework** | Fiber v2.52.13 (HTTP) |
| **Database** | PostgreSQL 15 |
| **Queue System** | Redis + Asynq 0.26.0 |
| **Real-time** | Server-Sent Events (SSE) |
| **API Docs** | Swagger/OpenAPI (auto-generated) |
| **Version** | 1.0.0 |
| **Current Branch** | `feature/process-forcus` |

---

## Project Overview

Buzz is a unified notification delivery platform that abstracts provider-specific implementation details behind a clean REST API. It handles:

- **Multi-channel delivery**: Email, SMS, push notifications, in-app messaging
- **Bulk operations**: Send to multiple recipients with progress tracking
- **Template management**: Reusable templates with variable substitution
- **Delivery tracking**: Status monitoring and analytics
- **Real-time streaming**: Server-Sent Events for instant in-app notifications
- **Queue monitoring**: Real-time statistics on queue health and worker performance
- **Request deduplication**: Idempotency keys for safe bulk operations

---

## Architecture Overview

### High-Level Flow

```
Client Request
    ↓
[API Layer] (fiber routes, middleware, validation)
    ↓
[Queue Producer] (Asynq → Redis)
    ↓
[Queue Worker] (processes jobs concurrently)
    ↓
[Provider Layer] (channel-specific implementations)
    ↓
[Storage Layer] (PostgreSQL for state, Redis for real-time)
    ↓
[External Services] (Email: SMTP/SES, SMS: Twilio/NotifyLK, Push: FCM)
```

### Core Components

#### 1. **API Layer** (`internal/api/`)
REST API endpoints organized by function:
- `notifications.go` — Send individual notifications
- `batch.go` — Bulk notification operations
- `templates.go` — Template CRUD and management
- `inbox.go` — In-app message retrieval and management
- `devices.go` — Push notification device token registration
- `webhooks.go` — Provider webhook handlers
- `middleware.go` — Authentication, logging, CORS
- `validation.go` — Request validation helpers
- `routes.go` — Route registration
- `sms_validation.go` — SMS number validation

**Key Endpoints:**
- `POST /api/v1/notifications/send` — Send a notification
- `POST /api/v1/notifications/batch` — Start bulk send
- `GET /api/v1/notifications/:id` — Get notification status
- `GET /api/v1/inbox/:user_id` — List in-app messages
- `GET /health` — Health check

#### 2. **Queue System** (`internal/queue/`)
Redis-backed distributed task queue using Asynq:
- `producer.go` — Enqueues notification tasks
- `worker.go` — Processes jobs concurrently (configurable concurrency)
- `inspector.go` — Monitors queue health and statistics
- `deadletter.go` — Handles failed tasks

**Managed Queues:**
- `email` — Email delivery
- `sms` — SMS delivery
- `push` — Push notification dispatch
- `inapp` — In-app message storage
- `batch` — Bulk batch coordination

#### 3. **Provider Layer** (`internal/provider/`)
Channel-specific implementations (pluggable):
- `provider.go` — Base interface
- `factory.go` — Provider initialization
- `email/` — SMTP and AWS SES implementations
- `sms/` — Twilio and NotifyLK implementations
- `push/` — Firebase Cloud Messaging (FCM)
- `inapp/` — In-app message storage (database-backed)
- `mock/` — Mock provider for testing

**Provider Interface:**
```go
type Provider interface {
    Send(ctx context.Context, notification *Notification) error
    GetStatus(ctx context.Context, id string) (Status, error)
    HandleWebhook(data []byte) error
}
```

#### 4. **Storage Layer** (`internal/store/`)
PostgreSQL database with automatic migrations:
- `postgres.go` — Database connection and lifecycle
- `notifications.go` — Notification CRUD
- `batches.go` — Batch operation tracking
- `templates.go` — Reusable notification templates
- `inbox.go` — In-app message storage
- `device_tokens.go` — Push device registrations
- `datasources.go` — External data source references
- `api_keys.go` — API key management and validation
- `migrations.go` — Schema versioning

**Core Tables:**
- `notifications` — Full notification lifecycle and status
- `batches` — Bulk operation metadata and progress
- `templates` — Reusable templates with variables
- `inbox` — In-app messages per recipient
- `device_tokens` — FCM/APNs device registrations
- `datasources` — External data source definitions
- `api_keys` — API credentials with scopes
- `schema_migrations` — Migration tracking

#### 5. **Real-time Gateway** (`internal/realtime/`)
Server-Sent Events (SSE) for live in-app notification streaming:
- `gateway.go` — Hub for managing SSE subscriptions
- `connection.go` — Individual client connections

**Flow:**
1. Client connects to `GET /api/v1/stream/:user_id` (WebSocket or SSE fallback)
2. Gateway maintains active connections in memory
3. When notification is queued, gateway broadcasts to all subscriptions for that user
4. Client receives real-time updates without polling

#### 6. **Batch Processing** (`internal/batch/`)
Bulk notification orchestration:
- `processor.go` — Fetches from datasource, enqueues individual tasks, tracks progress

**Flow:**
1. Batch request submitted with datasource ID
2. Processor fetches recipient list from datasource
3. Creates individual notification task per recipient
4. Tracks progress in `batches` table
5. Handles retries and failure aggregation

#### 7. **Datasource Integration** (`internal/datasource/`)
External data source client:
- `client.go` — Abstraction for fetching recipient lists (Google Sheets, CSV, JSON, API)

#### 8. **Configuration** (`internal/config/`)
Environment-based configuration using Viper:
- `config.go` — Loads from `.env` file
- Manages database, Redis, provider, and server settings

#### 9. **Domain Models** (`internal/domain/`)
Core type definitions:
- `models.go` — Notification, Batch, Template, Datasource, APIKey structures

**Key Types:**
- `Channel` — email, sms, push, in_app
- `Priority` — low, normal, high, urgent
- `NotificationStatus` — pending, queued, processing, sent, delivered, failed, cancelled
- `BatchStatus` — pending, processing, completed, failed, cancelled, fetching, queued, delivering
- `Environment` — production, staging, development, test
- `Platform` — ios, android, web

#### 10. **Logger** (`pkg/logger/`)
Structured logging with Zerolog:
- Outputs JSON by default
- Configurable level and format

---

## Project Structure

```
/workspaces/BUZZ-SERVICE/
├── cmd/
│   └── server/
│       └── main.go                 # Application entry point
├── internal/
│   ├── api/                        # HTTP handlers and routes
│   │   ├── notifications.go        # Send notification endpoints
│   │   ├── batch.go                # Bulk operation endpoints
│   │   ├── templates.go            # Template management
│   │   ├── inbox.go                # In-app message retrieval
│   │   ├── devices.go              # Device token management
│   │   ├── webhooks.go             # Provider webhooks
│   │   ├── routes.go               # Route registration
│   │   ├── middleware.go           # Auth, logging, CORS
│   │   ├── validation.go           # Request validation helpers
│   │   └── sms_validation.go       # SMS-specific validation
│   ├── batch/                      # Bulk processing logic
│   │   └── processor.go
│   ├── config/                     # Configuration management
│   │   └── config.go
│   ├── datasource/                 # External data source integration
│   │   └── client.go
│   ├── domain/                     # Domain models and constants
│   │   └── models.go
│   ├── provider/                   # Notification provider implementations
│   │   ├── provider.go             # Provider interface
│   │   ├── factory.go              # Provider initialization
│   │   ├── email/                  # SMTP, AWS SES
│   │   ├── sms/                    # Twilio, NotifyLK
│   │   ├── push/                   # Firebase Cloud Messaging
│   │   ├── inapp/                  # Database-backed in-app
│   │   └── mock/                   # Mock provider for testing
│   ├── queue/                      # Asynq queue system
│   │   ├── producer.go             # Task enqueueing
│   │   ├── worker.go               # Job processing
│   │   ├── inspector.go            # Queue monitoring
│   │   └── deadletter.go           # Failed task handling
│   ├── realtime/                   # SSE gateway for live updates
│   │   ├── gateway.go              # Connection hub
│   │   └── connection.go           # Individual connections
│   └── store/                      # PostgreSQL data access
│       ├── postgres.go             # Connection and lifecycle
│       ├── notifications.go        # Notification queries
│       ├── batches.go              # Batch queries
│       ├── templates.go            # Template queries
│       ├── inbox.go                # In-app message queries
│       ├── device_tokens.go        # Device token queries
│       ├── datasources.go          # Datasource queries
│       ├── api_keys.go             # API key queries
│       └── migrations.go           # Schema migrations
├── pkg/
│   └── logger/                     # Structured logging (Zerolog)
├── docs/
│   ├── swagger.json                # OpenAPI spec
│   ├── swagger.yaml                # OpenAPI spec
│   ├── docs.go                     # Swagger annotations (auto-generated)
│   └── ai/                         # Implementation planning phases
├── .env.example                    # Environment variables template
├── .env                            # Local configuration (git-ignored)
├── .air.toml                       # Hot-reload configuration
├── docker-compose.yml              # Local services (PostgreSQL, Redis)
├── Dockerfile                      # Production image
├── go.mod                          # Go module definition
├── go.sum                          # Dependency checksums
├── Makefile                        # Build targets (swagger, build, run)
├── README.md                       # User documentation
└── AGENT.md                        # This file

```

---

## Development Workflow

### Prerequisites
- Go 1.26.1+
- Docker and Docker Compose
- `air` for hot reload: `go install github.com/air-verse/air@latest`
- `swag` for Swagger generation: `go install github.com/swaggo/swag/cmd/swag@latest`

### Local Setup

```bash
# 1. Start infrastructure (PostgreSQL, Redis)
docker-compose up -d

# 2. Download dependencies
go mod download && go mod tidy

# 3. Start development server (with hot reload)
air -c .air.toml

# 4. Access the application
curl http://localhost:8080/health          # Health check
open http://localhost:8080/swagger/        # API docs
```

### Key Commands

```bash
# Generate/update Swagger documentation
make swagger

# Build the application
make build

# Run the application
make run

# Access the database
docker exec -it buzz-postgres psql -U buzz_user -d buzz_service

# View logs
docker-compose logs -f buzz-service
```

### Testing Workflow

```bash
# Run all tests
go test ./...

# Run tests for a specific package
go test -v ./internal/api

# Run with verbose output
go test -v ./...
```

---

## Configuration

### Environment Variables

See `.env.example` for the complete list. Key sections:

| Section | Variables | Notes |
|---------|-----------|-------|
| **Server** | `SERVER_PORT`, `SERVER_HOST`, `ENV` | HTTP server settings |
| **Database** | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL connection |
| **Redis** | `REDIS_HOST`, `REDIS_PORT` | Queue and real-time backend |
| **Email** | `EMAIL_PROVIDER` (smtp/ses), `EMAIL_FROM` | Email channel config |
| **SMS** | `SMS_PROVIDER` (notifylk/twilio/router) | SMS channel config |
| **Push** | `FCM_CREDENTIALS_FILE` | Firebase credentials path |
| **Logging** | `LOG_LEVEL` (debug/info/warn/error), `LOG_FORMAT` (json/text) | Logger settings |

### API Key Seeding

The database includes a test API key on first run:
```
Key: buzz_test_key_123
Scopes: notification:send, monitoring:read, inbox:read
```

Use this for development. For production, generate new keys with appropriate scopes.

---

## API Documentation

### Accessing Swagger UI

```
http://localhost:8080/swagger/
```

Click **Authorize** and enter:
```
Bearer buzz_test_key_123
```

### Keeping Docs in Sync

When modifying endpoints:
```bash
# Regenerate Swagger spec
make swagger

# Commit the updated docs/ directory
git add docs/
git commit -m "docs: update API spec"
```

---

## Recent Changes & Current Work

### Recent Commits

| Commit | Type | Description |
|--------|------|-------------|
| `d15eb14` | feat | Add AGENT.md files |
| `37b2eb4` | feat | Add pagination to template |
| `f68b2d0` | fix | Inbox issue fixed |
| `a2d2328` | fix | Swagger host fixed |

### Phases Completed (1-10)

The project follows a 10-phase implementation plan documented in `docs/ai/v-1.0.0-impl-plan/`:
1. ✅ Core API structure and health checks
2. ✅ Database setup and migrations
3. ✅ Notification domain models
4. ✅ Request validation and error handling
5. ✅ Email provider system (SMTP, SES)
6. ✅ SMS provider system (Twilio, NotifyLK)
7. ✅ Push provider system (FCM)
8. ✅ Real-time in-app notifications (SSE)
9. ✅ Bulk notifications and datasource integration
10. ✅ OpenAPI documentation and Swagger UI

### Current Branch: `feature/process-forcus`

This branch focuses on **process optimization and system consolidation** — improving the focus on core notification delivery workflows and refining existing features for production readiness.

---

## Key Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `gofiber/fiber` | 2.52.13 | HTTP framework (lightweight, fast) |
| `lib/pq` | 1.12.0 | PostgreSQL driver |
| `redis/go-redis` | 9.18.0 | Redis client |
| `hibiken/asynq` | 0.26.0 | Task queue |
| `swaggo/swag` | 1.16.6 | Swagger code generation |
| `rs/zerolog` | 1.34.0 | Structured logging |
| `spf13/viper` | 1.21.0 | Configuration management |
| `twilio/twilio-go` | 1.30.4 | Twilio SMS API |
| `aws/aws-sdk-go-v2` | 1.41.5 | AWS SES for email |
| `firebase.google.com/go` | 4.19.0 | Firebase Cloud Messaging |
| `google/uuid` | 1.6.0 | UUID generation |

---

## Database Schema

Migrations run automatically on startup. Tables created:

- `notifications` — Individual notification records with status tracking
- `batches` — Bulk operation metadata and progress
- `templates` — Reusable notification templates
- `inbox` — In-app message storage per user
- `device_tokens` — Push notification device registrations
- `datasources` — External data source definitions
- `api_keys` — API credentials and permission scopes
- `schema_migrations` — Migration version tracking

### Common Queries

```sql
-- Check notification status
SELECT id, channel, status, created_at FROM notifications WHERE id = '<uuid>' LIMIT 1;

-- Recent failed notifications
SELECT id, channel, error_message, failed_at FROM notifications 
WHERE status = 'failed' ORDER BY failed_at DESC LIMIT 10;

-- Queue stats (stored denormalized in monitoring endpoint)
SELECT COUNT(*) as total FROM notifications WHERE status = 'queued';

-- Template list with variables
SELECT name, channel, variables FROM templates ORDER BY created_at DESC;
```

---

## Common Tasks

### Adding a New Notification Channel

1. Create provider in `internal/provider/{channel}/` implementing `Provider` interface
2. Register in `factory.go` and `main.go`
3. Add domain constants in `domain/models.go`
4. Add storage methods in `store/notifications.go` if needed
5. Generate Swagger docs: `make swagger`
6. Test via direct API calls

### Creating a Reusable Template

Via API:
```bash
curl -X POST http://localhost:8080/api/v1/templates \
  -H "Authorization: Bearer buzz_test_key_123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "welcome_email",
    "channel": "email",
    "subject": "Welcome to {{app_name}}!",
    "body": "Hello {{user_name}}, thanks for signing up.",
    "variables": ["app_name", "user_name"]
  }'
```

### Sending a Bulk Notification

1. Create or reference a datasource (Google Sheets, CSV, API)
2. Submit batch request:
   ```bash
   curl -X POST http://localhost:8080/api/v1/notifications/batch \
     -H "Authorization: Bearer buzz_test_key_123" \
     -H "Content-Type: application/json" \
     -d '{
       "datasource_id": "<uuid>",
       "channel": "email",
       "priority": "normal",
       "subject": "Announcement",
       "body": "This is a bulk message"
     }'
   ```
3. Monitor progress via `/api/v1/batches/{batch_id}`

---

## Troubleshooting

### Service Won't Start

**Check database:**
```bash
docker-compose ps                    # Verify containers running
docker-compose logs buzz-postgres    # Check PostgreSQL logs
docker exec buzz-postgres pg_isready # Test connection
```

**Check migrations:**
```sql
SELECT * FROM schema_migrations;  -- View applied migrations
```

### Hot Reload Not Working

```bash
# Kill any existing air processes
pkill -f air

# Restart with verbose output
air -c .air.toml
```

### Database Connection Issues

```bash
# Test credentials
docker exec -it buzz-postgres psql -U buzz_user -d buzz_service -c "SELECT 1;"

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
```

---

## Git Workflow

### Current Status

```
Branch: feature/process-forcus
Ahead of main: 1 commit
Status: Clean (no uncommitted changes)
```

### Typical PR Workflow

1. Create feature branch from main
2. Implement changes
3. Update Swagger docs if modifying endpoints: `make swagger`
4. Test locally: `go test ./...`
5. Commit with clear messages (follow existing convention)
6. Push and create PR
7. Address review feedback
8. Merge to main

### Commit Convention

```
type: description

type: feat, fix, docs, refactor, test, chore
Example: "feat: add SMS rate limiting"
```

---

## Performance Considerations

### Queue Concurrency

Set in environment or code:
```go
Concurrency: 10  // Jobs processed in parallel (configurable)
```

Tune based on CPU cores and provider rate limits.

### Database Connection Pooling

PostgreSQL connection pool is configured in `config.go`. Adjust `MaxOpenConns` for high throughput.

### Real-time Scalability

SSE gateway is in-memory. For multiple service instances, use Redis Pub/Sub (infrastructure for this is already in place but not currently used for SSE).

### Batch Processing

Datasource fetching and job enqueueing happens in a single batch processor. For very large batches (>100k recipients), consider:
- Pagination within datasource fetch
- Rate-limited enqueueing to avoid Redis memory spike

---

## Security Notes

- API keys use Bearer token authentication
- Role-based access control (RBAC) with configurable scopes
- All queries are parameterized (no SQL injection risk)
- CORS enabled for browser clients
- Request IDs tracked on all inbound requests for audit logging
- Sensitive provider credentials stored in environment variables (never committed)

---

## Support & Resources

- **Swagger UI**: `http://localhost:8080/swagger/`
- **Admin Panel**: `http://localhost:8080/panel`
- **Health Check**: `GET http://localhost:8080/health`
- **README**: See `README.md` in project root for user documentation
- **Implementation Plan**: See `docs/ai/v-1.0.0-impl-plan/` for phase breakdowns
- **Logs**: `docker-compose logs -f buzz-service`

---

*Last Updated: 2026-05-07*
*Buzz Notification Service v1.0.0*
