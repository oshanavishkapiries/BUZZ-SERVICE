package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/elight/buzz-service/internal/store"
)

// DeviceHandler handles device token registration and management
type DeviceHandler struct {
	store *store.PostgresStore
}

// NewDeviceHandler creates a new device handler
func NewDeviceHandler(st *store.PostgresStore) *DeviceHandler {
	return &DeviceHandler{store: st}
}

// RegisterDevice handles POST /api/v1/devices/register
func (h *DeviceHandler) RegisterDevice(c *fiber.Ctx) error {
	var req struct {
		UserID   string `json:"user_id"`
		Token    string `json:"token"`
		Platform string `json:"platform"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	// Validate required fields
	if req.UserID == "" || req.Token == "" || req.Platform == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "user_id, token, and platform are required",
		})
	}

	// Validate platform
	validPlatforms := map[string]bool{"android": true, "ios": true, "web": true}
	if !validPlatforms[req.Platform] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid platform (must be: android, ios, or web)",
		})
	}

	deviceToken := &store.DeviceToken{
		ID:       uuid.New(),
		UserID:   req.UserID,
		Token:    req.Token,
		Platform: req.Platform,
		Active:   true,
	}

	if err := h.store.UpsertDeviceToken(c.Context(), deviceToken); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to register device",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "device registered successfully",
		"id":      deviceToken.ID,
	})
}

// ListUserDevices handles GET /api/v1/devices?user_id=xxx
func (h *DeviceHandler) ListUserDevices(c *fiber.Ctx) error {
	userID := c.Query("user_id")
	if userID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "user_id query parameter is required",
		})
	}

	tokens, err := h.store.GetUserDeviceTokens(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to fetch devices",
		})
	}

	if tokens == nil {
		tokens = []store.DeviceToken{}
	}

	return c.JSON(fiber.Map{
		"user_id": userID,
		"devices": tokens,
		"count":   len(tokens),
	})
}

// UnregisterDevice handles DELETE /api/v1/devices/:token
func (h *DeviceHandler) UnregisterDevice(c *fiber.Ctx) error {
	token := c.Params("token")
	if token == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "token parameter is required",
		})
	}

	if err := h.store.DeactivateDeviceToken(c.Context(), token); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to unregister device",
		})
	}

	return c.JSON(fiber.Map{
		"message": "device unregistered successfully",
	})
}
