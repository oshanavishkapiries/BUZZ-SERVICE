# Buzz Notification Service (v1.0.0)

Unified multi-channel notification delivery service supporting email, SMS, push notifications, and in-app messaging.

**Quick Links:**
- 🚀 [Development Setup](#-development-setup)
- 📚 [Swagger API Documentation](#-swagger--openapi-docs)
- 🐳 [Docker Setup](#-docker-commands)


## Features

- **Multi-channel delivery** - Email, SMS, push notifications, and in-app messaging
- **Bulk notifications** - Send to multiple recipients via external datasources with progress tracking
- **Real-time delivery** - Server-Sent Events (SSE) for instant in-app notifications
- **Template management** - Create and reuse notification templates with variable substitution
- **Delivery tracking** - Monitor notification status and delivery analytics
- **Queue monitoring** - Real-time queue statistics and performance monitoring
- **Request deduplication** - Idempotency keys for reliable bulk operations

## 🚀 Development Setup

### Prerequisites
- Go 1.26+
- Docker & Docker Compose
- Git

### Quick Start

#### 1. Install Go Dependencies
```bash
cd /workspaces/BUZZ-SERVICE
go mod download
go mod tidy
```

#### 2. Start Database & Redis with Docker
```bash
docker-compose up -d
```

This will start:
- **PostgreSQL** (v15) on port `5432`
  - Database: `buzz_service`
  - User: `buzz_user`
  - Password: `secure_password`
- **Redis** (v7) on port `6379`
- **Application** on port `8080`

Verify services are running:
```bash
docker-compose ps
```

#### 3. Run Development Server with Hot Reload

Using `air` for automatic rebuild and restart on file changes:

```bash
# Install air (if not already installed)
go install github.com/air-verse/air@latest

# Start dev server with hot reload
air -c .air.toml
```

The server will:
- Start on `http://localhost:8080`
- Auto-rebuild on `.go` file changes
- Auto-restart the application
- Log build errors to `build-errors.log`

#### 4. Verify Setup
```bash
# Check health endpoint
curl http://localhost:8080/health

# Expected response:
# {"status":"ok","database":"healthy","redis":"healthy"}
```

### Environment Configuration

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

Key configuration options:
- **Server**: `SERVER_PORT`, `SERVER_HOST`, `ENV`
- **Database**: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- **Redis**: `REDIS_HOST`, `REDIS_PORT`
- **Email**: `EMAIL_PROVIDER` (smtp/ses)
- **SMS**: `SMS_PROVIDER` (notifylk/twilio/router)
- **Push**: `FCM_CREDENTIALS_FILE`

## 📚 Swagger & OpenAPI Docs

### View Swagger UI Locally (When Backend Running)

Once the application is running, access the interactive Swagger UI:

**🔗 Local Swagger UI:** http://localhost:8080/swagger/

This provides:
- ✅ Full API documentation
- ✅ Try-out requests directly in the UI
- ✅ Request/response examples
- ✅ Authentication setup
- ✅ All endpoints with parameters

### Swagger UI Features
- **Test Endpoints**: Send requests directly from the UI
- **Authentication**: Add your API key for testing protected endpoints
- **Explore Models**: View data structures for requests/responses
- **Download Spec**: Export OpenAPI specification

### Alternative Ways to View API Docs

#### Online (View Only - External Links)
- **Swagger UI**: https://editor.swagger.io/?url=https://raw.githubusercontent.com/yourgithub/buzz-service/main/docs/openapi.yaml
- **ReDoc**: https://redocly.github.io/redoc/?url=https://raw.githubusercontent.com/yourgithub/buzz-service/main/docs/openapi.yaml

#### OpenAPI Specification File
The raw specification file is available at:
```
/workspaces/BUZZ-SERVICE/docs/openapi.yaml
```

### API Authentication in Swagger UI

To test protected endpoints in Swagger UI:

1. Look for the **Authorize** button (top right)
2. Click it and enter your API key in the format: `Bearer YOUR_API_KEY`
3. All subsequent requests will include the Authorization header

### Main API Endpoints

**Base URL**: `http://localhost:8080/api/v1`

**Authentication**: All endpoints require `Authorization: Bearer YOUR_API_KEY` header

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/notifications` | Send a single notification |
| GET | `/notifications` | List all notifications |
| GET | `/notifications/:id` | Get notification details |
| POST | `/batches/send` | Send bulk notifications |
| GET | `/batches/:id` | Get batch status |
| POST | `/templates` | Create notification template |
| GET | `/templates` | List all templates |
| GET | `/templates/:name` | Get template by name |
| PATCH | `/templates/:name` | Update template |
| POST | `/devices/register` | Register device for push notifications |
| GET | `/devices` | List user devices |
| GET | `/stream` | Real-time notification stream (SSE) |
| GET | `/monitoring/queues` | Get queue statistics |

See [complete OpenAPI spec](./docs/openapi.yaml) for all endpoints and models.

### Integration Examples

Example implementations in multiple languages:
- **[cURL examples](./docs/examples/curl-examples.sh)** - Shell/HTTP examples
- **[Python examples](./docs/examples/python-examples.py)** - Python client code
- **[JavaScript examples](./docs/examples/javascript-examples.js)** - Node.js & Browser examples

## 🛠️ Common Development Tasks

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f buzz-service
docker-compose logs -f buzz-postgres
docker-compose logs -f buzz-redis
```

### Access PostgreSQL Database
```bash
docker exec -it buzz-postgres psql -U buzz_user -d buzz_service

# List tables
\dt

# View table structure
\d notifications
```

### Rebuild Database (Reset)
```bash
# Stop and remove containers with volumes
docker-compose down -v

# Start fresh
docker-compose up -d
```

### Run Tests
```bash
go test ./...

# With verbose output
go test -v ./...

# Run specific package tests
go test -v ./internal/api
```

### Build for Production
```bash
CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o buzz-service ./cmd/server
```

### Build Docker Image Locally
```bash
docker build -t buzz-service:latest .
docker run -p 8080:8080 buzz-service:latest
```

## 🐳 Docker Commands

```bash
# Start services
docker-compose up -d

# Stop services (keep volumes)
docker-compose down

# Stop and remove everything (clear volumes)
docker-compose down -v

# View service status
docker-compose ps

# View real-time logs
docker-compose logs -f

# View logs from specific service
docker-compose logs -f buzz-service

# Rebuild images
docker-compose build --no-cache

# Restart specific service
docker-compose restart buzz-service

# Execute command in container
docker exec -it buzz-postgres psql -U buzz_user -d buzz_service
```

## 📊 Database Schema

PostgreSQL tables:
- `notifications` - Notification records with status tracking
- `batches` - Bulk notification batch metadata
- `templates` - Notification message templates
- `inbox` - In-app notification storage
- `device_tokens` - Push notification device registrations
- `datasources` - External data sources for bulk operations
- `api_keys` - API key management and scopes
- `schema_migrations` - Database migration tracking

Migrations run automatically on application startup.

## ⚙️ Queue System

Uses **Asynq** (Redis-backed task queue) for:
- Email delivery
- SMS delivery
- Push notifications
- In-app messaging
- Batch processing

Monitor queues:
```bash
# View all queue statistics
curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:8080/api/v1/monitoring/queues

# View specific queue stats
curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:8080/api/v1/monitoring/queues/email
```

## 🔐 Security

- ✅ API key authentication (Bearer token)
- ✅ Role-based access control (RBAC) with scopes
- ✅ CORS enabled for cross-origin requests
- ✅ Request ID tracking for audit logs
- ✅ SQL injection prevention
- ✅ Password hashing with bcrypt

## 📝 Environment Variables

See `.env.example` for complete list. Common variables:

```env
# Server
SERVER_PORT=8080
SERVER_HOST=0.0.0.0
ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=buzz_service
DB_USER=buzz_user
DB_PASSWORD=secure_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Email
EMAIL_PROVIDER=smtp
EMAIL_FROM=noreply@buzz.local

# SMS
SMS_PROVIDER=router

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

