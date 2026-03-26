package api

import (
	"net/http"
	"time"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/elight/buzz-service/internal/queue"
	"github.com/elight/buzz-service/internal/store"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// BatchHandler handles batch notification endpoints
type BatchHandler struct {
	store    *store.PostgresStore
	producer *queue.Producer
}

// NewBatchHandler creates a new batch handler
func NewBatchHandler(s *store.PostgresStore, producer *queue.Producer) *BatchHandler {
	return &BatchHandler{
		store:    s,
		producer: producer,
	}
}

// SendBulk sends a bulk notification
// POST /api/v1/batches/send
func (h *BatchHandler) SendBulk(c *fiber.Ctx) error {
	ctx := c.Context()

	var req struct {
		DatasourceName  string                 `json:"datasource_name"`
		EndpointName    string                 `json:"endpoint_name"`
		EndpointParams  map[string]interface{} `json:"endpoint_params"`
		TemplateName    string                 `json:"template_name"`
		TemplateData    map[string]interface{} `json:"template_data"`
		Channel         domain.Channel         `json:"channel"`
		Priority        domain.Priority        `json:"priority"`
		IdempotencyKey  string                 `json:"idempotency_key"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	// Validate required fields
	if req.DatasourceName == "" || req.EndpointName == "" || req.TemplateName == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "datasource_name, endpoint_name, and template_name are required",
		})
	}

	// Check for duplicate if idempotency key provided
	if req.IdempotencyKey != "" {
		existing, err := h.store.GetBatchByIdempotencyKey(ctx, req.IdempotencyKey)
		if err == nil && existing != nil {
			// Idempotent response: return existing batch ID
			return c.Status(http.StatusOK).JSON(fiber.Map{
				"batch_id": existing.ID,
				"message":  "batch already exists with this idempotency key",
			})
		}
	}

	// Fetch datasource to get ID
	ds, err := h.store.GetDatasourceByName(ctx, req.DatasourceName)
	if err != nil {
		if err == domain.ErrDatasourceNotFound {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{
				"error": "datasource not found",
			})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to fetch datasource",
		})
	}

	// Create batch
	batch := &domain.Batch{
		ID:              uuid.New(),
		DatasourceID:    &ds.ID,
		DatasourceName:  req.DatasourceName,
		EndpointName:    req.EndpointName,
		EndpointParams:  req.EndpointParams,
		TemplateName:    req.TemplateName,
		TemplateData:    req.TemplateData,
		Channel:         req.Channel,
		Priority:        req.Priority,
		Status:          domain.BatchStatusPending,
		IdempotencyKey:  req.IdempotencyKey,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	// Save batch to database
	if err := h.store.CreateBatch(ctx, batch); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create batch",
		})
	}

	// Enqueue batch processing task
	if err := h.producer.EnqueueBatchProcess(ctx, batch.ID.String()); err != nil {
		// Log error but don't fail the request - batch is created
		// Could implement a retry mechanism here
	}

	return c.Status(http.StatusAccepted).JSON(fiber.Map{
		"batch_id": batch.ID,
		"status":   batch.Status,
		"message":  "batch queued for processing",
	})
}

// GetBatchStatus gets the status of a batch
// GET /api/v1/batches/:id
func (h *BatchHandler) GetBatchStatus(c *fiber.Ctx) error {
	ctx := c.Context()

	batchID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid batch ID",
		})
	}

	batch, err := h.store.GetBatch(ctx, batchID)
	if err != nil {
		if err == domain.ErrBatchNotFound {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{
				"error": "batch not found",
			})
		}
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to fetch batch",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"batch_id":      batch.ID,
		"status":        batch.Status,
		"total":         batch.Total,
		"sent":          batch.Sent,
		"failed":        batch.Failed,
		"skipped":       batch.Skipped,
		"error_message": batch.ErrorMessage,
		"created_at":    batch.CreatedAt,
		"completed_at":  batch.CompletedAt,
	})
}

// ListBatches lists batches with optional status filter
// GET /api/v1/batches?status=completed&limit=10&offset=0
func (h *BatchHandler) ListBatches(c *fiber.Ctx) error {
	ctx := c.Context()

	status := c.Query("status", "")
	limit := c.QueryInt("limit", 10)
	offset := c.QueryInt("offset", 0)

	if limit > 100 {
		limit = 100
	}

	batches, total, err := h.store.ListBatches(ctx, status, limit, offset)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to list batches",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"batches": batches,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}
