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

// GetInbox godoc
// @Summary      Get inbox
// @Description  Retrieve the authenticated user's in-app notification inbox
// @Tags         inbox
// @Produce      json
// @Param        unread  query     bool  false  "Return only unread notifications (default false)"
// @Param        limit   query     int   false  "Page size (default 20)"
// @Param        offset  query     int   false  "Page offset (default 0)"
// @Success      200     {object}  map[string]interface{}
// @Failure      500     {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/inbox [get]
func (h *InboxHandler) GetInbox(c *fiber.Ctx) error {
	appID, err := GetApplicationID(c)
	if err != nil {
		return err
	}

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
		ApplicationID: appID,
		UserID:        userID,
		UnreadOnly:    unreadOnly,
		Limit:         limit,
		Offset:        offset,
	}

	entries, total, err := h.st.GetInbox(c.Context(), filters)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to fetch inbox",
		})
	}

	unreadCount, err := h.st.GetUnreadCount(c.Context(), appID, userID)
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

// MarkAsRead godoc
// @Summary      Mark as read
// @Description  Mark a single inbox notification as read
// @Tags         inbox
// @Produce      json
// @Param        id   path      string  true  "Inbox entry UUID"
// @Success      200  {object}  MessageResponse
// @Failure      400  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/inbox/{id}/read [patch]
func (h *InboxHandler) MarkAsRead(c *fiber.Ctx) error {
	appID, err := GetApplicationID(c)
	if err != nil {
		return err
	}

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

	if err := h.st.MarkInboxAsRead(c.Context(), appID, id, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to mark as read",
		})
	}

	return c.JSON(fiber.Map{
		"message": "marked as read",
	})
}

// MarkAllAsRead godoc
// @Summary      Mark all as read
// @Description  Mark all inbox notifications as read for the authenticated user
// @Tags         inbox
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Failure      500  {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/inbox/read-all [post]
func (h *InboxHandler) MarkAllAsRead(c *fiber.Ctx) error {
	appID, err := GetApplicationID(c)
	if err != nil {
		return err
	}

	userID := c.Locals("user_id").(string)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "user_id not found in context",
		})
	}

	count, err := h.st.MarkAllInboxAsRead(c.Context(), appID, userID)
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

// DeleteNotification godoc
// @Summary      Delete inbox notification
// @Description  Permanently delete a notification from the authenticated user's inbox
// @Tags         inbox
// @Produce      json
// @Param        id   path      string  true  "Inbox entry UUID"
// @Success      200  {object}  MessageResponse
// @Failure      400  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/inbox/{id} [delete]
func (h *InboxHandler) DeleteNotification(c *fiber.Ctx) error {
	appID, err := GetApplicationID(c)
	if err != nil {
		return err
	}

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

	if err := h.st.DeleteInboxEntry(c.Context(), appID, id, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to delete notification",
		})
	}

	return c.JSON(fiber.Map{
		"message": "notification deleted",
	})
}
