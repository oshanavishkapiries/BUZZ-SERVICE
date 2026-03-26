package api

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/elight/buzz-service/internal/store"
)

// InboxHandler handles inbox-related HTTP requests
type InboxHandler struct {
	st *store.PostgresStore
}

// NewInboxHandler creates a new inbox handler
func NewInboxHandler(st *store.PostgresStore) *InboxHandler {
	return &InboxHandler{st: st}
}

// GetInbox handles GET /api/v1/inbox
func (h *InboxHandler) GetInbox(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "user_id not found in context",
		})
	}

	unreadOnly := c.QueryBool("unread", false)
	limit := c.QueryInt("limit", 20)
	offset := c.QueryInt("offset", 0)

	filters := store.InboxFilters{
		UserID:     userID,
		UnreadOnly: unreadOnly,
		Limit:      limit,
		Offset:     offset,
	}

	entries, total, err := h.st.GetInbox(c.Context(), filters)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to fetch inbox",
		})
	}

	unreadCount, err := h.st.GetUnreadCount(c.Context(), userID)
	if err != nil {
		unreadCount = 0
	}

	return c.JSON(fiber.Map{
		"data":         entries,
		"total":        total,
		"unread_count": unreadCount,
		"limit":        limit,
		"offset":       offset,
	})
}

// MarkAsRead handles PATCH /api/v1/inbox/:id/read
func (h *InboxHandler) MarkAsRead(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "user_id not found in context",
		})
	}

	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid inbox entry id",
		})
	}

	if err := h.st.MarkInboxAsRead(c.Context(), id, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to mark as read",
		})
	}

	return c.JSON(fiber.Map{
		"message": "marked as read",
	})
}

// MarkAllAsRead handles POST /api/v1/inbox/read-all
func (h *InboxHandler) MarkAllAsRead(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "user_id not found in context",
		})
	}

	count, err := h.st.MarkAllInboxAsRead(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to mark all as read",
		})
	}

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("marked %d notifications as read", count),
		"count":   count,
	})
}

// DeleteNotification handles DELETE /api/v1/inbox/:id
func (h *InboxHandler) DeleteNotification(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "user_id not found in context",
		})
	}

	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid inbox entry id",
		})
	}

	if err := h.st.DeleteInboxEntry(c.Context(), id, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to delete notification",
		})
	}

	return c.JSON(fiber.Map{
		"message": "notification deleted",
	})
}
