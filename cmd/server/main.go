package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/elight/buzz-service/internal/api"
	"github.com/elight/buzz-service/internal/config"
	"github.com/elight/buzz-service/internal/domain"
	"github.com/elight/buzz-service/internal/provider"
	"github.com/elight/buzz-service/internal/provider/mock"
	"github.com/elight/buzz-service/internal/queue"
	"github.com/elight/buzz-service/internal/store"
	"github.com/elight/buzz-service/pkg/logger"
	"github.com/gofiber/fiber/v2"
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

	// Initialize providers (mock for now)
	providers := map[domain.Channel]provider.Provider{
		domain.ChannelEmail: mock.NewMockProvider("mock-email", domain.ChannelEmail, appLogger),
		domain.ChannelSMS:   mock.NewMockProvider("mock-sms", domain.ChannelSMS, appLogger),
		domain.ChannelPush:  mock.NewMockProvider("mock-push", domain.ChannelPush, appLogger),
		domain.ChannelInApp: mock.NewMockProvider("mock-inapp", domain.ChannelInApp, appLogger),
	}

	// Initialize worker
	worker := queue.NewWorker(
		queue.WorkerConfig{
			RedisAddr:     redisAddr,
			RedisPassword: cfg.Redis.Password,
			Concurrency:   cfg.Queue.Concurrency,
			Queues:        cfg.Queue.Queues,
		},
		db,
		providers,
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
	api.SetupRoutes(app, db, producer, cfg)

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
