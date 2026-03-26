package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hibiken/asynq"
	"github.com/elight/buzz-service/internal/domain"
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
		asynq.MaxRetry(n.MaxRetries),
		asynq.Timeout(5 * time.Minute),
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

