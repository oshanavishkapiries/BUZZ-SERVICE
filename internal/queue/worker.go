package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hibiken/asynq"
	"github.com/elight/buzz-service/internal/batch"
	"github.com/elight/buzz-service/internal/datasource"
	"github.com/elight/buzz-service/internal/domain"
	"github.com/elight/buzz-service/internal/provider"
	"github.com/elight/buzz-service/internal/store"
	"github.com/google/uuid"
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
	providerInstance, err := w.registry.Resolve(notification.ApplicationID, notification.Channel, providerName)
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
		if err := w.store.IncrementBatchSent(ctx, notification.ApplicationID, *notification.BatchID); err != nil {
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
		AppID   string `json:"application_id"`
		BatchID string `json:"batch_id"`
	}
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("failed to unmarshal batch payload: %w", err)
	}

	appID, err := uuid.Parse(payload.AppID)
	if err != nil {
		return fmt.Errorf("invalid application_id %q: %w", payload.AppID, err)
	}
	batchID, err := uuid.Parse(payload.BatchID)
	if err != nil {
		return fmt.Errorf("invalid batch_id %q: %w", payload.BatchID, err)
	}

	w.logger.Info().
		Str("app_id", payload.AppID).
		Str("batch_id", payload.BatchID).
		Msg("Processing batch")

	// Fetch the batch to know the delivery channel, then resolve a provider for it.
	b, err := w.store.GetBatch(ctx, appID, batchID)
	if err != nil {
		return fmt.Errorf("failed to fetch batch %s: %w", batchID, err)
	}

	prov, err := w.registry.Resolve(appID, b.Channel, "")
	if err != nil {
		return fmt.Errorf("no provider for channel %s: %w", b.Channel, err)
	}

	templateRepo := store.NewTemplateRepository(w.store.DB())
	dsClient := datasource.NewClient()

	processor := batch.NewProcessor(w.store, dsClient, templateRepo, prov)

	if err := processor.ProcessBatch(ctx, appID, batchID); err != nil {
		w.logger.Error().Err(err).
			Str("batch_id", batchID.String()).
			Msg("Batch processing failed")
		return err
	}

	w.logger.Info().
		Str("batch_id", batchID.String()).
		Msg("Batch processing completed")

	return nil
}

