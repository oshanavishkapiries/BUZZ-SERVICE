package api

import (
	"fmt"
	"strings"
	"time"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/elight/buzz-service/internal/store"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// NotificationHandler handles notification-related HTTP requests
type NotificationHandler struct {
	store *store.PostgresStore
}

// NewNotificationHandler creates a new notification handler
func NewNotificationHandler(store *store.PostgresStore) *NotificationHandler {
	return &NotificationHandler{
		store: store,
	}
}

// SendNotification handles POST /api/v1/notifications
func (h *NotificationHandler) SendNotification(c *fiber.Ctx) error {
	var req SendNotificationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error":   "invalid request body",
			"details": err.Error(),
		})
	}

	// Validate request
	if err := req.Validate(); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error":   "validation failed",
			"details": err.Error(),
		})
	}

	ctx := c.Context()

	// TODO: Check idempotency (will be implemented with notification-filters)
	// if req.IdempotencyKey != "" {
	// 	existing, err := h.store.GetNotificationByIdempotencyKey(ctx, req.IdempotencyKey)
	// 	if err == nil {
	// 		return c.Status(200).JSON(fiber.Map{
	// 			"id":      existing.ID,
	// 			"status":  existing.Status,
	// 			"message": "notification already exists (idempotency)",
	// 		})
	// 	}
	// }

	// Process template if provided
	var body, subject string
	var templateData map[string]interface{}

	if req.Template != "" {
		template, err := h.store.GetTemplateByName(ctx, req.Template)
		if err != nil {
			return c.Status(404).JSON(fiber.Map{
				"error":    "template not found",
				"template": req.Template,
			})
		}

		// Check if template supports the request channel
		channelSupported := false
		for _, ch := range template.Channels {
			if ch == string(req.Channel) {
				channelSupported = true
				break
			}
		}
		if !channelSupported && len(template.Channels) > 0 {
			return c.Status(400).JSON(fiber.Map{
				"error":   "template channel mismatch",
				"details": fmt.Sprintf("template supports %v but request is for %s", template.Channels, req.Channel),
			})
		}

		// Render template with data
		templateData = req.Data
		body = renderTemplate(template.Body, req.Data)
		
		if template.Subject != nil && *template.Subject != "" {
			subject = renderTemplate(*template.Subject, req.Data)
		} else if req.Subject != "" {
			subject = req.Subject
		}
	} else {
		body = req.Body
		subject = req.Subject
		templateData = req.Data
	}

	// Build recipient JSONB
	recipient := domain.JSONB{
		"address": req.To,
	}
	if req.RecipientID != "" {
		recipient["id"] = req.RecipientID
	}
	if req.RecipientName != "" {
		recipient["name"] = req.RecipientName
	}

	// Create notification record
	now := time.Now()
	subjectPtr := &subject
	if subject == "" {
		subjectPtr = nil
	}

	notification := &domain.Notification{
		ID:         uuid.New(),
		Channel:    req.Channel,
		Priority:   req.Priority,
		Recipient:  recipient,
		Subject:    subjectPtr,
		Body:       body,
		Variables:  templateData,
		Status:     domain.StatusQueued,
		RetryCount: 0,
		MaxRetries: 3,
		QueuedAt:   &now,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	// Save to database
	repo := store.NewNotificationRepository(h.store.DB())
	if err := repo.Create(ctx, notification); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "failed to create notification",
			"details": err.Error(),
		})
	}

	// TODO: Enqueue for processing (Phase 4 - Queue integration)
	// For now, notifications are just stored in database with status "queued"

	return c.Status(202).JSON(fiber.Map{
		"id":      notification.ID,
		"status":  notification.Status,
		"message": "notification queued for delivery",
	})
}

// GetNotification handles GET /api/v1/notifications/:id
func (h *NotificationHandler) GetNotification(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "invalid notification id format (must be UUID)",
		})
	}

	repo := store.NewNotificationRepository(h.store.DB())
	notification, err := repo.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{
			"error": "notification not found",
		})
	}

	return c.JSON(notification)
}

// ListNotifications handles GET /api/v1/notifications
func (h *NotificationHandler) ListNotifications(c *fiber.Ctx) error {
	// Parse query parameters
	status := c.Query("status")
	channel := c.Query("channel")
	recipientID := c.Query("recipient_id")
	limit := c.QueryInt("limit", 20)
	offset := c.QueryInt("offset", 0)

	// Validate limit
	if limit < 1 || limit > 100 {
		return c.Status(400).JSON(fiber.Map{
			"error": "limit must be between 1 and 100",
		})
	}

	// Build filters
	filters := map[string]interface{}{}

	if status != "" {
		filters["status"] = domain.NotificationStatus(status)
	}
	if channel != "" {
		filters["channel"] = domain.Channel(channel)
	}
	if recipientID != "" {
		filters["recipient_id"] = recipientID
	}

	repo := store.NewNotificationRepository(h.store.DB())
	notifications, err := repo.List(c.Context(), filters, limit, offset)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "failed to fetch notifications",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"data":   notifications,
		"total":  len(notifications),
		"limit":  limit,
		"offset": offset,
	})
}

// renderTemplate performs simple variable substitution in templates
// Replaces {{variable}} placeholders with actual values from data
func renderTemplate(template string, data map[string]interface{}) string {
	if data == nil {
		return template
	}

	result := template
	for key, value := range data {
		placeholder := fmt.Sprintf("{{%s}}", key)
		replacement := fmt.Sprint(value)
		result = strings.ReplaceAll(result, placeholder, replacement)
	}
	return result
}
