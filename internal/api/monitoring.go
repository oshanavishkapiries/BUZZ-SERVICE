package api

import (
	"github.com/elight/buzz-service/internal/queue"
	"github.com/gofiber/fiber/v2"
)

type MonitoringHandler struct {
	inspector *queue.Inspector
}

func NewMonitoringHandler(inspector *queue.Inspector) *MonitoringHandler {
	return &MonitoringHandler{inspector: inspector}
}

// GetQueueStats godoc
// @Summary      Get queue stats
// @Description  Retrieve processing statistics for a specific queue
// @Tags         monitoring
// @Produce      json
// @Param        queue  path      string  true  "Queue name"
// @Success      200    {object}  map[string]interface{}
// @Failure      500    {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/monitoring/queues/{queue} [get]
func (h *MonitoringHandler) GetQueueStats(c *fiber.Ctx) error {
	queueName := c.Params("queue")

	stats, err := h.inspector.GetQueueStats(c.Context(), queueName)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":      "failed to fetch queue stats",
			"queue":      queueName,
			"details":    err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"queue":      queueName,
		"size":       stats.Size,
		"processed":  stats.Processed,
		"failed":     stats.Failed,
		"paused":     stats.Paused,
	})
}

// ListQueues godoc
// @Summary      List queues
// @Description  Retrieve the names of all active notification queues
// @Tags         monitoring
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Failure      500  {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/monitoring/queues [get]
func (h *MonitoringHandler) ListQueues(c *fiber.Ctx) error {
	queues, err := h.inspector.ListQueues(c.Context())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "failed to list queues",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"queues": queues,
		"count":  len(queues),
	})
}

// GetAllQueueStats godoc
// @Summary      Get all queue stats
// @Description  Retrieve aggregated processing statistics across all notification queues
// @Tags         monitoring
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Failure      500  {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/monitoring/stats [get]
func (h *MonitoringHandler) GetAllQueueStats(c *fiber.Ctx) error {
	queues, err := h.inspector.ListQueues(c.Context())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "failed to list queues",
			"details": err.Error(),
		})
	}

	statsMap := make(map[string]interface{})
	totalActive := 0
	totalPending := 0
	totalProcessed := 0
	totalFailed := 0

	for _, queue := range queues {
		stats, err := h.inspector.GetQueueStats(c.Context(), queue)
		if err != nil {
			continue
		}

		statsMap[queue] = fiber.Map{
			"size":      stats.Size,
			"processed": stats.Processed,
			"failed":    stats.Failed,
			"paused":    stats.Paused,
		}

		totalActive += stats.Size
		totalPending += stats.Size
		totalProcessed += stats.Processed
		totalFailed += stats.Failed
	}

	return c.JSON(fiber.Map{
		"queues": statsMap,
		"totals": fiber.Map{
			"active":    totalActive,
			"pending":   totalPending,
			"processed": totalProcessed,
			"failed":    totalFailed,
		},
	})
}
