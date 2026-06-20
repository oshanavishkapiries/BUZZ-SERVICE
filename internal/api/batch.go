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

// SendBulk godoc
// @Summary      Send bulk notifications
// @Description  Fetch recipients from a datasource and send notifications using a template
// @Tags         batches
// @Accept       json
// @Produce      json
// @Param        body  body      SendBulkRequest         true  "Bulk notification payload"
// @Success      202   {object}  map[string]interface{}  "Batch queued"
// @Success      200   {object}  map[string]interface{}  "Duplicate — existing batch returned (idempotency)"
// @Failure      400   {object}  ErrorResponse
// @Failure      404   {object}  ErrorResponse           "Datasource not found"
// @Failure      500   {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/batches/send [post]
func (h *BatchHandler) SendBulk(c *fiber.Ctx) error {
	ctx := c.Context()
	appID, err := GetApplicationID(c)
	if err != nil {
		return err
	}

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
		existing, err := h.store.GetBatchByIdempotencyKey(ctx, appID, req.IdempotencyKey)
		if err == nil && existing != nil {
			// Idempotent response: return existing batch ID
			return c.Status(http.StatusOK).JSON(fiber.Map{
				"batch_id": existing.ID,
				"message":  "batch already exists with this idempotency key",
			})
		}
	}

	// Fetch datasource to get ID
	ds, err := h.store.GetDatasourceByName(ctx, appID, req.DatasourceName)
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
		ApplicationID:   appID,
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
			"error":   "failed to create batch",
			"details": err.Error(),
		})
	}

	// Enqueue batch processing task
	if err := h.producer.EnqueueBatchProcess(ctx, appID.String(), batch.ID.String()); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error":   "batch saved but failed to enqueue for processing",
			"details": err.Error(),
			"batch_id": batch.ID,
		})
	}

	return c.Status(http.StatusAccepted).JSON(fiber.Map{
		"batch_id": batch.ID,
		"status":   batch.Status,
		"message":  "batch queued for processing",
	})
}

// GetBatchStatus godoc
// @Summary      Get batch status
// @Description  Retrieve the processing status and progress of a bulk notification batch
// @Tags         batches
// @Produce      json
// @Param        id   path      string  true  "Batch UUID"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  ErrorResponse
// @Failure      404  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/batches/{id} [get]
func (h *BatchHandler) GetBatchStatus(c *fiber.Ctx) error {
	ctx := c.Context()
	appID, err := GetApplicationID(c)
	if err != nil {
		return err
	}

	batchID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid batch ID",
		})
	}

	batch, err := h.store.GetBatch(ctx, appID, batchID)
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

	return c.Status(http.StatusOK).JSON(batch)
}

// RetryBatch godoc
// @Summary      Retry a stuck or failed batch
// @Description  Re-enqueue a batch that is stuck in pending or failed state
// @Tags         batches
// @Produce      json
// @Param        id   path      string  true  "Batch UUID"
// @Success      202  {object}  map[string]interface{}
// @Failure      400  {object}  ErrorResponse
// @Failure      404  {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/batches/{id}/retry [post]
func (h *BatchHandler) RetryBatch(c *fiber.Ctx) error {
	ctx := c.Context()
	appID, err := GetApplicationID(c)
	if err != nil {
		return err
	}

	batchID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid batch ID"})
	}

	batch, err := h.store.GetBatch(ctx, appID, batchID)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "batch not found"})
	}

	if batch.Status != "pending" && batch.Status != "failed" {
		return c.Status(http.StatusConflict).JSON(fiber.Map{
			"error": "only pending or failed batches can be retried",
		})
	}

	// Reset to pending so the processor starts fresh
	if err := h.store.UpdateBatchStatus(ctx, appID, batchID, "pending"); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "failed to reset batch status"})
	}

	if err := h.producer.EnqueueBatchProcess(ctx, appID.String(), batchID.String()); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to re-enqueue batch",
			"details": err.Error(),
		})
	}

	return c.Status(http.StatusAccepted).JSON(fiber.Map{
		"message":  "batch re-queued for processing",
		"batch_id": batchID,
	})
}

// CancelBatch godoc
// @Summary      Cancel a batch
// @Description  Cancel a batch that is still pending, fetching, or queued (not yet delivering)
// @Tags         batches
// @Produce      json
// @Param        id   path      string  true  "Batch UUID"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  ErrorResponse
// @Failure      404  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/batches/{id}/cancel [post]
func (h *BatchHandler) CancelBatch(c *fiber.Ctx) error {
	ctx := c.Context()
	appID, err := GetApplicationID(c)
	if err != nil {
		return err
	}

	batchID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid batch ID"})
	}

	if err := h.store.CancelBatch(ctx, appID, batchID); err != nil {
		return c.Status(http.StatusConflict).JSON(fiber.Map{
			"error":   "cannot cancel batch",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{"message": "batch cancelled"})
}

// DeleteBatch godoc
// @Summary      Delete a batch
// @Description  Permanently delete a batch in a terminal state (cancelled, failed, or completed)
// @Tags         batches
// @Produce      json
// @Param        id   path      string  true  "Batch UUID"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  ErrorResponse
// @Failure      409  {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/batches/{id} [delete]
func (h *BatchHandler) DeleteBatch(c *fiber.Ctx) error {
	ctx := c.Context()
	appID, err := GetApplicationID(c)
	if err != nil {
		return err
	}

	batchID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid batch ID"})
	}

	if err := h.store.DeleteBatch(ctx, appID, batchID); err != nil {
		return c.Status(http.StatusConflict).JSON(fiber.Map{
			"error":   "cannot delete batch",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{"message": "batch deleted"})
}

// ListBatches godoc
// @Summary      List batches
// @Description  Retrieve a paginated list of bulk notification batches with optional status filter
// @Tags         batches
// @Produce      json
// @Param        status  query     string  false  "Filter by status (pending, processing, completed, failed)"
// @Param        limit   query     int     false  "Page size max 100 (default 10)"
// @Param        offset  query     int     false  "Page offset (default 0)"
// @Success      200     {object}  map[string]interface{}
// @Failure      500     {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/batches [get]
func (h *BatchHandler) ListBatches(c *fiber.Ctx) error {
	ctx := c.Context()
	appID, err := GetApplicationID(c)
	if err != nil {
		return err
	}

	status := c.Query("status", "")
	limit := c.QueryInt("limit", 10)
	offset := c.QueryInt("offset", 0)

	if limit > 100 {
		limit = 100
	}

	batches, total, err := h.store.ListBatches(ctx, appID, status, limit, offset)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to list batches",
			"details": err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"batches": batches,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}
