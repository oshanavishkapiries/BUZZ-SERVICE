// @title           Buzz Notification Service API
// @version         1.0.0
// @description     Unified notification delivery service supporting email, SMS, push notifications, and in-app messaging with bulk sending capabilities.
// @contact.name    API Support
// @contact.email   support@yourdomain.com
// @BasePath        /
// @securityDefinitions.apikey  Bearer
// @in                          header
// @name                        Authorization
// @description                 API key prefixed with "Bearer ", e.g. "Bearer YOUR_API_KEY"

package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/elight/buzz-service/docs"
	"github.com/elight/buzz-service/internal/api"
	"github.com/elight/buzz-service/internal/config"
	"github.com/elight/buzz-service/internal/domain"
	"github.com/elight/buzz-service/internal/provider"
	"github.com/elight/buzz-service/internal/provider/inapp"
	"github.com/elight/buzz-service/internal/queue"
	"github.com/elight/buzz-service/internal/realtime"
	"github.com/elight/buzz-service/internal/store"
	"github.com/elight/buzz-service/pkg/logger"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize logger
	appLogger := logger.New(cfg.Logger)

	appLogger.Info().Msg("Starting Buzz Notification Service")

	// Initialize database
	db, err := store.NewPostgresStore(&cfg.Database)
	if err != nil {
		appLogger.Fatal().Err(err).Msg("Failed to connect to database")
	}
	defer db.Close()

	appLogger.Info().Msg("Connected to database successfully")

	// Run migrations
	if err := db.Migrate(context.Background()); err != nil {
		appLogger.Fatal().Err(err).Msg("Failed to run migrations")
	}
	appLogger.Info().Msg("Database migrations completed")

	// Initialize queue producer
	redisAddr := fmt.Sprintf("%s:%d", cfg.Redis.Host, cfg.Redis.Port)
	producer, err := queue.NewProducer(redisAddr, cfg.Redis.Password)
	if err != nil {
		appLogger.Fatal().Err(err).Msg("Failed to create queue producer")
	}
	defer producer.Close()

	// Initialize Redis client for real-time gateway
	redisClient := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: cfg.Redis.Password,
		DB:       0,
	})
	defer redisClient.Close()

	// Initialize SSE gateway
	gateway := realtime.NewGateway(redisClient, appLogger)
	gateway.Start()
	defer gateway.Stop()

	// Build provider registry from database configs.
	// In-app is always wired directly (no DB config needed).
	registryCtx := context.Background()
	registry, err := provider.NewRegistry(registryCtx, db, redisClient)
	if err != nil {
		appLogger.Fatal().Err(err).Msg("Failed to initialise provider registry")
	}
	// In-app is always available — wire it directly into the registry.
	inappProvider := inapp.NewInAppProvider(db, redisClient)
	registry.RegisterFixed(domain.ChannelInApp, inappProvider)

	// Initialize worker
	worker := queue.NewWorker(
		queue.WorkerConfig{
			RedisAddr:     redisAddr,
			RedisPassword: cfg.Redis.Password,
			Concurrency:   cfg.Queue.Concurrency,
			Queues:        cfg.Queue.Queues,
		},
		db,
		registry,
		appLogger,
	)

	// Start worker in background
	go func() {
		if err := worker.Start(); err != nil {
			appLogger.Fatal().Err(err).Msg("Worker failed")
		}
	}()

	appLogger.Info().Msg("Queue system initialized")

	// Initialize Fiber app
	app := fiber.New(fiber.Config{
		AppName:      "Buzz Service v1.0.0",
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	})

	// Setup routes
	api.SetupRoutes(app, db, producer, cfg, gateway, registry)

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-quit
		appLogger.Info().Msg("Shutting down server...")

		// Shutdown worker first (stop accepting new tasks)
		worker.Shutdown()

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := app.ShutdownWithContext(ctx); err != nil {
			appLogger.Fatal().Err(err).Msg("Server forced to shutdown")
		}
	}()

	// Start server
	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	appLogger.Info().Str("address", addr).Msg("Starting server")

	if err := app.Listen(addr); err != nil {
		appLogger.Fatal().Err(err).Msg("Server failed to start")
	}
}
