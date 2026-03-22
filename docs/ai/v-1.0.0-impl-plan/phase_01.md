# Phase 01: Project Foundation & Core Infrastructure

## Objectives
- Set up project structure and development environment
- Initialize core configuration system
- Establish database connectivity
- Create health check endpoint

---

## 1.1 Project Initialization

### Tech Stack
- **Runtime**: Go 1.21+ (low resource usage, excellent concurrency)
- **Database**: PostgreSQL 15+ (notification logs, templates, batches)
- **Queue**: Redis 7+ with asynq (job queue with retry, scheduling)
- **Web Framework**: Fiber v2 (Express-like API for Go)

### Repository Structure
```
buzz-service/
├── cmd/
│   └── server/
│       └── main.go              # Application entry point
├── internal/
│   ├── api/
│   │   ├── handler.go           # HTTP handlers
│   │   ├── middleware.go        # Auth, CORS, rate limiting
│   │   └── routes.go            # Route definitions
│   ├── config/
│   │   └── config.go            # Environment configuration
│   ├── domain/
│   │   └── models.go            # Core domain types
│   └── store/
│       ├── postgres.go          # Database connection pool
│       └── migrations/          # SQL migration files
├── pkg/
│   └── logger/
│       └── logger.go            # Structured logging (zerolog)
├── .env.example                 # Environment template
├── .gitignore
├── go.mod
├── go.sum
├── Makefile                     # Build automation
├── Dockerfile
├── docker-compose.yml           # Local dev environment
└── README.md
```

---

## 1.2 Environment Configuration

### Required Environment Variables
```bash
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
DB_SSL_MODE=disable
DB_MAX_CONNECTIONS=20
DB_MAX_IDLE_CONNECTIONS=5

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### Config Package Implementation
```go
// internal/config/config.go
package config

import (
    "time"
    "github.com/spf13/viper"
)

type Config struct {
    Server   ServerConfig
    Database DatabaseConfig
    Redis    RedisConfig
    Logger   LoggerConfig
}

type ServerConfig struct {
    Port         int
    Host         string
    Env          string
    ReadTimeout  time.Duration
    WriteTimeout time.Duration
}

type DatabaseConfig struct {
    Host            string
    Port            int
    Name            string
    User            string
    Password        string
    SSLMode         string
    MaxConnections  int
    MaxIdleConns    int
}

type RedisConfig struct {
    Host     string
    Port     int
    Password string
    DB       int
}

type LoggerConfig struct {
    Level  string
    Format string
}

func Load() (*Config, error) {
    // Load from environment variables
    // Return validated configuration
}
```

---

## 1.3 Database Setup

### PostgreSQL Connection Pool
```go
// internal/store/postgres.go
package store

import (
    "context"
    "database/sql"
    "fmt"
    "time"

    _ "github.com/lib/pq"
)

type PostgresStore struct {
    db *sql.DB
}

func NewPostgresStore(cfg *config.DatabaseConfig) (*PostgresStore, error) {
    dsn := fmt.Sprintf(
        "host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
        cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Name, cfg.SSLMode,
    )

    db, err := sql.Open("postgres", dsn)
    if err != nil {
        return nil, err
    }

    db.SetMaxOpenConns(cfg.MaxConnections)
    db.SetMaxIdleConns(cfg.MaxIdleConns)
    db.SetConnMaxLifetime(time.Hour)

    // Test connection
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    if err := db.PingContext(ctx); err != nil {
        return nil, err
    }

    return &PostgresStore{db: db}, nil
}

func (s *PostgresStore) Close() error {
    return s.db.Close()
}

func (s *PostgresStore) Health(ctx context.Context) error {
    return s.db.PingContext(ctx)
}
```

### Initial Migration (000_init.sql)
```sql
-- migrations/000_init.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- System info table (for schema versioning)
CREATE TABLE system_info (
    key   VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO system_info (key, value) VALUES ('schema_version', '000');
```

---

## 1.4 Core API Server

### Main Entry Point
```go
// cmd/server/main.go
package main

import (
    "context"
    "fmt"
    "log"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/gofiber/fiber/v2"
    "buzz-service/internal/config"
    "buzz-service/internal/api"
    "buzz-service/internal/store"
    "buzz-service/pkg/logger"
)

func main() {
    // Load configuration
    cfg, err := config.Load()
    if err != nil {
        log.Fatalf("Failed to load config: %v", err)
    }

    // Initialize logger
    logger := logger.New(cfg.Logger)

    // Initialize database
    db, err := store.NewPostgresStore(&cfg.Database)
    if err != nil {
        logger.Fatal().Err(err).Msg("Failed to connect to database")
    }
    defer db.Close()

    // Initialize Fiber app
    app := fiber.New(fiber.Config{
        AppName:      "Buzz Service v1.0.0",
        ReadTimeout:  cfg.Server.ReadTimeout,
        WriteTimeout: cfg.Server.WriteTimeout,
    })

    // Setup routes
    api.SetupRoutes(app, db, logger)

    // Graceful shutdown
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

    go func() {
        <-quit
        logger.Info().Msg("Shutting down server...")
        
        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()
        
        if err := app.ShutdownWithContext(ctx); err != nil {
            logger.Fatal().Err(err).Msg("Server forced to shutdown")
        }
    }()

    // Start server
    addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
    logger.Info().Str("address", addr).Msg("Starting server")
    
    if err := app.Listen(addr); err != nil {
        logger.Fatal().Err(err).Msg("Server failed to start")
    }
}
```

---

## 1.5 Health Check Endpoint

### Routes Setup
```go
// internal/api/routes.go
package api

import (
    "github.com/gofiber/fiber/v2"
    "github.com/gofiber/fiber/v2/middleware/cors"
    "github.com/gofiber/fiber/v2/middleware/recover"
)

func SetupRoutes(app *fiber.App, db *store.PostgresStore, logger logger.Logger) {
    // Global middleware
    app.Use(recover.New())
    app.Use(cors.New())

    // Health check
    app.Get("/health", HealthCheck(db))
    
    // API v1 routes
    v1 := app.Group("/api/v1")
    v1.Get("/health", HealthCheck(db))
}

func HealthCheck(db *store.PostgresStore) fiber.Handler {
    return func(c *fiber.Ctx) error {
        ctx := c.Context()
        
        // Check database
        if err := db.Health(ctx); err != nil {
            return c.Status(503).JSON(fiber.Map{
                "status": "unhealthy",
                "checks": fiber.Map{
                    "database": "down",
                },
                "error": err.Error(),
            })
        }

        return c.JSON(fiber.Map{
            "status": "healthy",
            "version": "1.0.0",
            "checks": fiber.Map{
                "database": "up",
            },
        })
    }
}
```

---

## 1.6 Docker Setup

### Dockerfile
```dockerfile
# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o buzz-service ./cmd/server

# Runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/buzz-service .

EXPOSE 8080
CMD ["./buzz-service"]
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: buzz_service
      POSTGRES_USER: buzz_user
      POSTGRES_PASSWORD: secure_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  buzz-service:
    build: .
    ports:
      - "8080:8080"
    depends_on:
      - postgres
      - redis
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
    env_file:
      - .env

volumes:
  postgres_data:
  redis_data:
```

---

## 1.7 Makefile

```makefile
.PHONY: help build run test clean docker-up docker-down migrate-up migrate-down

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Build the application
	go build -o bin/buzz-service ./cmd/server

run: ## Run the application
	go run ./cmd/server/main.go

test: ## Run tests
	go test -v ./...

clean: ## Clean build artifacts
	rm -rf bin/

docker-up: ## Start docker containers
	docker-compose up -d

docker-down: ## Stop docker containers
	docker-compose down

docker-logs: ## View docker logs
	docker-compose logs -f buzz-service

migrate-up: ## Run database migrations
	@echo "Running migrations..."

migrate-down: ## Rollback last migration
	@echo "Rolling back migration..."

lint: ## Run linter
	golangci-lint run

fmt: ## Format code
	go fmt ./...
```

---

## 1.8 Deliverables

✅ Go project initialized with proper structure
✅ Configuration management system
✅ PostgreSQL connection pool with health check
✅ Redis connection (basic setup)
✅ HTTP server with Fiber framework
✅ Health check endpoint (`GET /health`)
✅ Docker setup for local development
✅ Makefile for common tasks
✅ Structured logging system

---

## 1.9 Testing Phase 1

### Manual Tests
```bash
# Start infrastructure
make docker-up

# Build and run service
make build
make run

# Test health endpoint
curl http://localhost:8080/health

# Expected response:
# {
#   "status": "healthy",
#   "version": "1.0.0",
#   "checks": {
#     "database": "up"
#   }
# }
```

### Validation Checklist
- [ ] Server starts without errors
- [ ] Health endpoint returns 200 OK
- [ ] Database connection verified
- [ ] Configuration loads from environment
- [ ] Graceful shutdown works (Ctrl+C)
- [ ] Docker containers start successfully

---

## Next Phase
**Phase 02**: Database schema for notifications, batches, and datasources + migration system
