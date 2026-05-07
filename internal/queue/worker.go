package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hibiken/asynq"
	"github.com/elight/buzz-service/internal/domain"
	"github.com/elight/buzz-service/internal/provider"
	"github.com/elight/buzz-service/internal/store"
	"github.com/rs/zerolog"
)

type Worker struct {
	server   *asynq.Server
	mux      *asynq.ServeMux
	store    *store.PostgresStore
	registry *provider.Registry
	logger   zerolog.Logger
}

type WorkerConfig struct {
	RedisAddr     string
	RedisPassword string
	Concurrency   int
	Queues        map[string]int // queue name -> priority weight
}

func NewWorker(
	cfg WorkerConfig,
	dbStore *store.PostgresStore,
	registry *provider.Registry,
	logger zerolog.Logger,
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
					Msg("Task failed")
			}),
		},
	)

	mux := asynq.NewServeMux()

	w := &Worker{
		server:   server,
		mux:      mux,
		store:    dbStore,
		registry: registry,
		logger:   logger,
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

	// Extract recipient address from recipient JSONB
	recipientAddr := ""
	if notification.Recipient != nil {
		if addr, ok := notification.Recipient["address"].(string); ok {
			recipientAddr = addr
		}
	}

	w.logger.Info().
		Str("notification_id", notification.ID.String()).
		Str("channel", string(notification.Channel)).
		Str("to", recipientAddr).
		Msg("Processing notification")

	// Resolve provider: use explicitly chosen provider or fall back to default for channel
	providerName := ""
	if notification.Provider != nil {
		providerName = *notification.Provider
	}
	providerInstance, err := w.registry.Resolve(notification.Channel, providerName)
	if err != nil {
		return fmt.Errorf("no provider available for channel %s: %w", notification.Channel, err)
	}

	// Attempt delivery
	startTime := time.Now()
	err = providerInstance.Send(ctx, &notification)
	duration := time.Since(startTime)

	// Update notification status
	if err != nil {
		w.logger.Error().
			Err(err).
			Str("notification_id", notification.ID.String()).
			Dur("duration", duration).
			Msg("Notification delivery failed")

		// Mark as failed with error message
		errorMsg := err.Error()
		notification.ErrorMessage = &errorMsg
		notification.Status = domain.StatusFailed
		notification.FailedAt = &startTime

		repo := store.NewNotificationRepository(w.store.DB())
		if err := repo.Update(ctx, &notification); err != nil {
			w.logger.Error().Err(err).Msg("Failed to update notification status")
		}

		return err // Return error to trigger retry
	}

	// Mark as sent
	now := time.Now()
	notification.Status = domain.StatusSent
	notification.SentAt = &now

	repo := store.NewNotificationRepository(w.store.DB())
	if err := repo.Update(ctx, &notification); err != nil {
		w.logger.Error().Err(err).Msg("Failed to update notification status")
		return err
	}

	// Update batch counters if part of a batch
	// Note: Phase 9 batch processing is handled separately in the batch processor
	// Individual notifications from Phase 9 batches can optionally track batch_id for audit
	if notification.BatchID != nil {
		if err := w.store.IncrementBatchSent(ctx, *notification.BatchID); err != nil {
			w.logger.Error().Err(err).Msg("Failed to increment batch sent count")
			// Don't fail the notification delivery if batch update fails
		}
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

	// This is a placeholder. The actual batch processing is done by the batch processor
	// which is invoked separately. The queue worker here would trigger batch processing
	// if needed, but for Phase 9 the batch processor is responsible.
	return nil
}

