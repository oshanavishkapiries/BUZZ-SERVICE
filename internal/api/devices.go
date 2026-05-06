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

// RegisterDevice godoc
// @Summary      Register a device
// @Description  Register a push notification device token for a user
// @Tags         devices
// @Accept       json
// @Produce      json
// @Param        body  body      RegisterDeviceRequest  true  "Device registration payload"
// @Success      201   {object}  map[string]interface{}
// @Failure      400   {object}  ErrorResponse
// @Failure      500   {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/devices/register [post]
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

// ListUserDevices godoc
// @Summary      List user devices
// @Description  Retrieve all registered device tokens for a user
// @Tags         devices
// @Produce      json
// @Param        user_id  query     string  true  "User ID"
// @Success      200      {object}  map[string]interface{}
// @Failure      400      {object}  ErrorResponse
// @Failure      500      {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/devices [get]
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

// UnregisterDevice godoc
// @Summary      Unregister a device
// @Description  Deactivate a push notification device token
// @Tags         devices
// @Produce      json
// @Param        token  path      string  true  "Device token"
// @Success      200    {object}  MessageResponse
// @Failure      400    {object}  ErrorResponse
// @Failure      500    {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/devices/{token} [delete]
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
