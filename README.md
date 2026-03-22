# Buzz Notification Service

Unified multi-channel notification delivery service supporting email, SMS, push notifications, and in-app messaging.

## Features

- **Multi-Channel**: Email (SES/SMTP), SMS (NotifyLK/Twilio), Push (FCM), In-App (SSE)
- **Bulk Notifications**: Fetch recipients from external datasources and fan out
- **Templates**: Manage notification templates with variable substitution
- **Real-Time**: Server-Sent Events for instant in-app notifications
- **Scalable**: Queue-based architecture with Redis and worker pools
- **Observable**: Prometheus metrics and structured logging

## Tech Stack

- **Runtime**: Go 1.21+
- **Database**: PostgreSQL 15+
- **Queue**: Redis 7+ with asynq
- **Web Framework**: Fiber v2

## Quick Start

### Prerequisites

- Go 1.21+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose

### Local Development

```bash
# Clone repository
git clone https://github.com/ediflix/buzz-service.git
cd buzz-service

# Copy environment file
cp .env.example .env

# Start dependencies (PostgreSQL & Redis)
docker-compose up -d postgres redis

# Install Go dependencies
go mod download

# Run the service
make run
```

The service will start on `http://localhost:8080`

### With Docker

```bash
# Start all services (including the application)
docker-compose up -d

# View logs
docker-compose logs -f buzz-service
```

## Configuration

Edit `.env` file to configure the service. See `.env.example` for all available options.

Key configurations:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - PostgreSQL connection
- `REDIS_HOST`, `REDIS_PORT` - Redis connection
- `SERVER_PORT` - HTTP server port (default: 8080)
- `LOG_LEVEL` - Logging level (debug, info, warn, error)

## API Endpoints

### Health Check
```bash
curl http://localhost:8080/health
```

## Development

```bash
# Format code
make fmt

# Run tests
make test

# Build binary
make build

# Clean build artifacts
make clean
```

## Project Status

Currently implementing **Phase 02: Database Schema & Migration System** ✅

### Implementation Phases

- [x] Phase 01: Project Foundation & Core Infrastructure
- [x] Phase 02: Database Schema & Migration System
- [ ] Phase 03: Single Notification API & Authentication
- [ ] Phase 04: Queue System & Worker Infrastructure
- [ ] Phase 05: Email Provider Implementation
- [ ] Phase 06: SMS Provider Implementation
- [ ] Phase 07: Push Notification Provider (FCM)
- [ ] Phase 08: Real-Time In-App Notifications (SSE)
- [ ] Phase 09: Bulk Notifications & Datasource Integration
- [ ] Phase 10: Documentation, Deployment & Production Readiness

## Documentation

- [Implementation Plan](docs/ai/v-1.0.0-impl-plan/) - Detailed phase-by-phase implementation guide
- API Documentation - Coming soon

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
