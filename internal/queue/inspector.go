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

func (i *Inspector) GetQueueStats(ctx context.Context, queue string) (*asynq.QueueInfo, error) {
	return i.inspector.GetQueueInfo(queue)
}

func (i *Inspector) ListQueues(ctx context.Context) ([]string, error) {
	return i.inspector.Queues()
}

func (i *Inspector) Close() error {
	return i.inspector.Close()
}
