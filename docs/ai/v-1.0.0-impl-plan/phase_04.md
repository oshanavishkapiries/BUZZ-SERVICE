# Phase 04: Queue System & Worker Infrastructure

## Objectives
- Set up Redis connection with asynq
- Implement queue producer for enqueueing notifications
- Create worker consumer for processing notifications
- Add retry logic with exponential backoff
- Implement dead-letter queue for failed notifications
- Add priority queue support

---

## 4.1 Redis Client Setup

```go
// internal/queue/redis.go
package queue

import (
    "github.com/redis/go-redis/v9"
    "buzz-service/internal/config"
)

func NewRedisClient(cfg *config.RedisConfig) *redis.Client {
    return redis.NewClient(&redis.Options{
        Addr:     fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
        Password: cfg.Password,
        DB:       cfg.DB,
        PoolSize: 20,
    })
}
```

---

## 4.2 Queue Producer

```go
// internal/queue/producer.go
package queue

import (
    "context"
    "encoding/json"
    "fmt"
    "time"

    "github.com/hibiken/asynq"
    "buzz-service/internal/domain"
)

const (
    TypeNotification = "notification:deliver"
    TypeBatchProcess = "batch:process"
)

// Task priority levels (higher number = higher priority)
const (
    PriorityHigh   = 3
    PriorityNormal = 2
    PriorityLow    = 1
)

type Producer struct {
    client *asynq.Client
}

func NewProducer(redisAddr string, redisPassword string) (*Producer, error) {
    client := asynq.NewClient(asynq.RedisClientOpt{
        Addr:     redisAddr,
        Password: redisPassword,
    })

    return &Producer{client: client}, nil
}

func (p *Producer) Close() error {
    return p.client.Close()
}

// EnqueueNotification enqueues a single notification for delivery
func (p *Producer) EnqueueNotification(ctx context.Context, n *domain.Notification) error {
    payload, err := json.Marshal(n)
    if err != nil {
        return fmt.Errorf("failed to marshal notification: %w", err)
    }

    task := asynq.NewTask(TypeNotification, payload)

    // Task options
    opts := []asynq.Option{
        asynq.Queue(string(n.Channel)), // Route to channel-specific queue
        asynq.MaxRetry(n.MaxAttempts),
        asynq.Timeout(5 * time.Minute),
    }

    // Set priority
    switch n.Priority {
    case domain.PriorityHigh:
        opts = append(opts, asynq.Priority(PriorityHigh))
    case domain.PriorityLow:
        opts = append(opts, asynq.Priority(PriorityLow))
    default:
        opts = append(opts, asynq.Priority(PriorityNormal))
    }

    // Schedule for future if specified
    if n.ScheduledFor != nil && n.ScheduledFor.After(time.Now()) {
        opts = append(opts, asynq.ProcessAt(*n.ScheduledFor))
    }

    // Set unique ID for deduplication
    opts = append(opts, asynq.TaskID(n.ID.String()))

    info, err := p.client.EnqueueContext(ctx, task, opts...)
    if err != nil {
        return fmt.Errorf("failed to enqueue notification: %w", err)
    }

    // Log enqueue info (optional)
    _ = info // info.ID, info.Queue, info.MaxRetry, info.Retried

    return nil
}

// EnqueueBatchProcess enqueues a batch processing task
func (p *Producer) EnqueueBatchProcess(ctx context.Context, batchID string) error {
    payload, err := json.Marshal(map[string]string{"batch_id": batchID})
    if err != nil {
        return err
    }

    task := asynq.NewTask(TypeBatchProcess, payload)
    
    opts := []asynq.Option{
        asynq.Queue("batch"),
        asynq.MaxRetry(3),
        asynq.Timeout(30 * time.Minute),
    }

    _, err = p.client.EnqueueContext(ctx, task, opts...)
    return err
}
```

---

## 4.3 Worker Consumer

```go
// internal/queue/worker.go
package queue

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "time"

    "github.com/hibiken/asynq"
    "buzz-service/internal/domain"
    "buzz-service/internal/provider"
    "buzz-service/internal/store"
    "buzz-service/pkg/logger"
)

type Worker struct {
    server    *asynq.Server
    mux       *asynq.ServeMux
    store     *store.PostgresStore
    providers map[domain.Channel]provider.Provider
    logger    logger.Logger
}

type WorkerConfig struct {
    RedisAddr     string
    RedisPassword string
    Concurrency   int
    Queues        map[string]int // queue name -> priority weight
}

func NewWorker(
    cfg WorkerConfig,
    store *store.PostgresStore,
    providers map[domain.Channel]provider.Provider,
    logger logger.Logger,
) *Worker {
    // Configure asynq server
    server := asynq.NewServer(
        asynq.RedisClientOpt{
            Addr:     cfg.RedisAddr,
            Password: cfg.RedisPassword,
        },
        asynq.Config{
            Concurrency: cfg.Concurrency,
            Queues:      cfg.Queues,
            
            // Retry configuration
            RetryDelayFunc: func(n int, err error, task *asynq.Task) time.Duration {
                // Exponential backoff: 1s, 2s, 4s, 8s, 16s, ...
                return time.Duration(1<<uint(n)) * time.Second
            },
            
            // Error handler
            ErrorHandler: asynq.ErrorHandlerFunc(func(ctx context.Context, task *asynq.Task, err error) {
                logger.Error().
                    Err(err).
                    Str("task_type", task.Type()).
                    Str("task_id", task.ResultWriter().TaskID()).
                    Int("retry", task.ResultWriter().Retried()).
                    Msg("Task failed")
            }),
        },
    )

    mux := asynq.NewServeMux()
    
    w := &Worker{
        server:    server,
        mux:       mux,
        store:     store,
        providers: providers,
        logger:    logger,
    }

    // Register task handlers
    mux.HandleFunc(TypeNotification, w.HandleNotification)
    mux.HandleFunc(TypeBatchProcess, w.HandleBatchProcess)

    return w
}

func (w *Worker) Start() error {
    w.logger.Info().Msg("Starting worker...")
    return w.server.Run(w.mux)
}

func (w *Worker) Shutdown() {
    w.logger.Info().Msg("Shutting down worker...")
    w.server.Shutdown()
}

// HandleNotification processes a single notification delivery
func (w *Worker) HandleNotification(ctx context.Context, task *asynq.Task) error {
    var notification domain.Notification
    if err := json.Unmarshal(task.Payload(), &notification); err != nil {
        return fmt.Errorf("failed to unmarshal notification: %w", err)
    }

    w.logger.Info().
        Str("notification_id", notification.ID.String()).
        Str("channel", string(notification.Channel)).
        Str("to", notification.ToAddress).
        Msg("Processing notification")

    // Get provider for channel
    providerInstance, ok := w.providers[notification.Channel]
    if !ok {
        return fmt.Errorf("no provider configured for channel: %s", notification.Channel)
    }

    // Attempt delivery
    startTime := time.Now()
    err := providerInstance.Send(ctx, &notification)
    duration := time.Since(startTime)

    // Update notification status
    if err != nil {
        // Mark as failed (will retry if attempts < max_attempts)
        w.store.UpdateNotificationStatus(
            ctx,
            notification.ID,
            domain.StatusFailed,
            err.Error(),
        )

        w.logger.Error().
            Err(err).
            Str("notification_id", notification.ID.String()).
            Dur("duration", duration).
            Msg("Notification delivery failed")

        return err // Return error to trigger retry
    }

    // Mark as sent
    w.store.UpdateNotificationStatus(
        ctx,
        notification.ID,
        domain.StatusSent,
        "",
    )

    // Update batch counters if part of a batch
    if notification.BatchID != nil {
        w.store.IncrementBatchSent(ctx, *notification.BatchID)
    }

    w.logger.Info().
        Str("notification_id", notification.ID.String()).
        Dur("duration", duration).
        Msg("Notification delivered successfully")

    return nil
}

// HandleBatchProcess processes a batch of notifications
func (w *Worker) HandleBatchProcess(ctx context.Context, task *asynq.Task) error {
    var payload struct {
        BatchID string `json:"batch_id"`
    }
    
    if err := json.Unmarshal(task.Payload(), &payload); err != nil {
        return err
    }

    w.logger.Info().
        Str("batch_id", payload.BatchID).
        Msg("Processing batch")

    // Implementation in Phase 05
    return nil
}
```

---

## 4.4 Queue Configuration

```go
// internal/config/config.go (updated)
package config

type QueueConfig struct {
    RedisAddr     string
    RedisPassword string
    Concurrency   int
    Queues        map[string]int
}

func defaultQueueConfig() QueueConfig {
    return QueueConfig{
        Concurrency: 10,
        Queues: map[string]int{
            "email":  3, // Priority weight
            "sms":    3,
            "push":   2,
            "in_app": 2,
            "batch":  1,
        },
    }
}
```

---

## 4.5 Provider Interface

```go
// internal/provider/provider.go
package provider

import (
    "context"
    "buzz-service/internal/domain"
)

// Provider defines the interface for notification delivery providers
type Provider interface {
    // Send delivers a notification
    Send(ctx context.Context, notification *domain.Notification) error
    
    // Name returns the provider name
    Name() string
    
    // SupportsChannel checks if the provider supports a given channel
    SupportsChannel(channel domain.Channel) bool
}

// RateLimitedProvider extends Provider with rate limiting
type RateLimitedProvider interface {
    Provider
    
    // RateLimit returns the max requests per second
    RateLimit() int
}
```

---

## 4.6 Mock Provider (for testing)

```go
// internal/provider/mock/mock.go
package mock

import (
    "context"
    "fmt"
    "time"
    "buzz-service/internal/domain"
    "buzz-service/internal/provider"
)

type MockProvider struct {
    name    string
    channel domain.Channel
    delay   time.Duration
}

func NewMockProvider(name string, channel domain.Channel) provider.Provider {
    return &MockProvider{
        name:    name,
        channel: channel,
        delay:   100 * time.Millisecond, // Simulate network delay
    }
}

func (p *MockProvider) Send(ctx context.Context, n *domain.Notification) error {
    // Simulate processing time
    time.Sleep(p.delay)
    
    // Simulate 5% failure rate for testing retry logic
    if time.Now().Unix()%20 == 0 {
        return fmt.Errorf("mock provider: simulated failure")
    }
    
    fmt.Printf("[%s] Delivered to %s: %s\n", p.name, n.ToAddress, n.Body)
    return nil
}

func (p *MockProvider) Name() string {
    return p.name
}

func (p *MockProvider) SupportsChannel(channel domain.Channel) bool {
    return channel == p.channel
}
```

---

## 4.7 Integration in Main

```go
// cmd/server/main.go (updated)
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
    "buzz-service/internal/api"
    "buzz-service/internal/config"
    "buzz-service/internal/domain"
    "buzz-service/internal/provider"
    "buzz-service/internal/provider/mock"
    "buzz-service/internal/queue"
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

    // Run migrations
    if err := db.Migrate(context.Background()); err != nil {
        logger.Fatal().Err(err).Msg("Failed to run migrations")
    }

    // Initialize queue producer
    redisAddr := fmt.Sprintf("%s:%d", cfg.Redis.Host, cfg.Redis.Port)
    producer, err := queue.NewProducer(redisAddr, cfg.Redis.Password)
    if err != nil {
        logger.Fatal().Err(err).Msg("Failed to create queue producer")
    }
    defer producer.Close()

    // Initialize providers (mock for now)
    providers := map[domain.Channel]provider.Provider{
        domain.ChannelEmail:  mock.NewMockProvider("mock-email", domain.ChannelEmail),
        domain.ChannelSMS:    mock.NewMockProvider("mock-sms", domain.ChannelSMS),
        domain.ChannelPush:   mock.NewMockProvider("mock-push", domain.ChannelPush),
        domain.ChannelInApp:  mock.NewMockProvider("mock-inapp", domain.ChannelInApp),
    }

    // Initialize worker
    worker := queue.NewWorker(
        queue.WorkerConfig{
            RedisAddr:     redisAddr,
            RedisPassword: cfg.Redis.Password,
            Concurrency:   10,
            Queues: map[string]int{
                "email":  3,
                "sms":    3,
                "push":   2,
                "in_app": 2,
                "batch":  1,
            },
        },
        db,
        providers,
        logger,
    )

    // Start worker in background
    go func() {
        if err := worker.Start(); err != nil {
            logger.Fatal().Err(err).Msg("Worker failed")
        }
    }()

    // Initialize Fiber app
    app := fiber.New(fiber.Config{
        AppName:      "Buzz Service v1.0.0",
        ReadTimeout:  cfg.Server.ReadTimeout,
        WriteTimeout: cfg.Server.WriteTimeout,
    })

    // Setup routes
    api.SetupRoutes(app, db, producer)

    // Graceful shutdown
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

    go func() {
        <-quit
        logger.Info().Msg("Shutting down...")
        
        // Shutdown worker first (stop accepting new tasks)
        worker.Shutdown()
        
        // Shutdown HTTP server
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

## 4.8 Dead Letter Queue Handler

```go
// internal/queue/deadletter.go
package queue

import (
    "context"
    "encoding/json"
    "time"

    "github.com/hibiken/asynq"
    "buzz-service/internal/domain"
    "buzz-service/internal/store"
)

// DeadLetterHandler processes permanently failed tasks
type DeadLetterHandler struct {
    store *store.PostgresStore
}

func NewDeadLetterHandler(store *store.PostgresStore) *DeadLetterHandler {
    return &DeadLetterHandler{store: store}
}

func (h *DeadLetterHandler) Handle(ctx context.Context, task *asynq.Task) error {
    switch task.Type() {
    case TypeNotification:
        return h.handleFailedNotification(ctx, task)
    default:
        return nil
    }
}

func (h *DeadLetterHandler) handleFailedNotification(ctx context.Context, task *asynq.Task) error {
    var notification domain.Notification
    if err := json.Unmarshal(task.Payload(), &notification); err != nil {
        return err
    }

    // Mark as permanently failed
    return h.store.UpdateNotificationStatus(
        ctx,
        notification.ID,
        domain.StatusFailed,
        "Maximum retry attempts exceeded",
    )
}
```

---

## 4.9 Queue Monitoring

```go
// internal/queue/inspector.go
package queue

import (
    "context"
    "github.com/hibiken/asynq"
)

type Inspector struct {
    inspector *asynq.Inspector
}

func NewInspector(redisAddr, redisPassword string) *Inspector {
    return &Inspector{
        inspector: asynq.NewInspector(asynq.RedisClientOpt{
            Addr:     redisAddr,
            Password: redisPassword,
        }),
    }
}

func (i *Inspector) GetQueueStats(ctx context.Context, queue string) (*asynq.Stats, error) {
    return i.inspector.GetQueueInfo(queue)
}

func (i *Inspector) ListQueues(ctx context.Context) ([]string, error) {
    return i.inspector.Queues()
}
```

---

## 4.10 Monitoring API Endpoints

```go
// internal/api/monitoring.go
package api

import (
    "github.com/gofiber/fiber/v2"
    "buzz-service/internal/queue"
)

type MonitoringHandler struct {
    inspector *queue.Inspector
}

func NewMonitoringHandler(inspector *queue.Inspector) *MonitoringHandler {
    return &MonitoringHandler{inspector: inspector}
}

func (h *MonitoringHandler) GetQueueStats(c *fiber.Ctx) error {
    queueName := c.Params("queue")
    
    stats, err := h.inspector.GetQueueStats(c.Context(), queueName)
    if err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "failed to fetch queue stats",
        })
    }

    return c.JSON(fiber.Map{
        "queue":      queueName,
        "active":     stats.Active,
        "pending":    stats.Pending,
        "scheduled":  stats.Scheduled,
        "retry":      stats.Retry,
        "archived":   stats.Archived,
        "completed":  stats.Completed,
        "aggregated": stats.Aggregating,
    })
}

func (h *MonitoringHandler) ListQueues(c *fiber.Ctx) error {
    queues, err := h.inspector.ListQueues(c.Context())
    if err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "failed to list queues",
        })
    }

    return c.JSON(fiber.Map{
        "queues": queues,
    })
}
```

---

## 4.11 Updated Environment Variables

```bash
# Queue Configuration
QUEUE_CONCURRENCY=10
QUEUE_REDIS_ADDR=localhost:6379
QUEUE_REDIS_PASSWORD=

# Worker Queues (priority weights)
QUEUE_EMAIL_WEIGHT=3
QUEUE_SMS_WEIGHT=3
QUEUE_PUSH_WEIGHT=2
QUEUE_INAPP_WEIGHT=2
QUEUE_BATCH_WEIGHT=1
```

---

## 4.12 Deliverables

✅ Redis connection with asynq
✅ Queue producer for enqueueing notifications
✅ Worker consumer with task handlers
✅ Exponential backoff retry logic
✅ Dead-letter queue handling
✅ Priority queue support
✅ Channel-specific queues
✅ Mock provider for testing
✅ Queue monitoring endpoints
✅ Graceful shutdown

---

## 4.13 Testing Phase 4

```bash
# Start Redis
docker-compose up -d redis

# Start the service (includes worker)
make run

# Send a test notification
curl -X POST http://localhost:8080/api/v1/notifications \
  -H "Authorization: Bearer buzz_test_key_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "channel": "email",
    "subject": "Test",
    "body": "Testing queue delivery",
    "priority": "normal"
  }'

# Check worker logs
# Should see: "Processing notification" → "Notification delivered successfully"

# Monitor queue stats
curl http://localhost:8080/api/v1/monitoring/queues/email \
  -H "Authorization: Bearer buzz_test_key_abc123"
```

---

## Next Phase
**Phase 05**: Email provider implementation (Amazon SES / SMTP)
