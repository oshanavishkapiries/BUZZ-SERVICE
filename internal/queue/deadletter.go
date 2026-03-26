package queue

import (
	"context"
	"encoding/json"
	"time"

	"github.com/hibiken/asynq"
	"github.com/elight/buzz-service/internal/domain"
	"github.com/elight/buzz-service/internal/store"
	"github.com/rs/zerolog"
)

// DeadLetterHandler processes permanently failed tasks
type DeadLetterHandler struct {
	store  *store.PostgresStore
	logger zerolog.Logger
}

func NewDeadLetterHandler(dbStore *store.PostgresStore, logger zerolog.Logger) *DeadLetterHandler {
	return &DeadLetterHandler{
		store:  dbStore,
		logger: logger,
	}
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

	h.logger.Error().
		Str("notification_id", notification.ID.String()).
		Msg("Notification moved to dead letter queue")

	// Mark as permanently failed
	errorMsg := "Maximum retry attempts exceeded"
	notification.ErrorMessage = &errorMsg
	notification.Status = domain.StatusFailed
	now := time.Now()
	notification.FailedAt = &now

	repo := store.NewNotificationRepository(h.store.DB())
	return repo.Update(ctx, &notification)
}
