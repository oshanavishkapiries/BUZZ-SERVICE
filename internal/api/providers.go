package api

import (
	"time"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/elight/buzz-service/internal/provider"
	"github.com/elight/buzz-service/internal/store"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// ProviderHandler handles provider config CRUD requests
type ProviderHandler struct {
	store    *store.PostgresStore
	registry *provider.Registry
}

// NewProviderHandler creates a new provider handler
func NewProviderHandler(store *store.PostgresStore, registry *provider.Registry) *ProviderHandler {
	return &ProviderHandler{store: store, registry: registry}
}

// CreateProvider godoc
// @Summary      Create a provider config
// @Description  Register a new provider configuration (email, SMS, push)
// @Tags         providers
// @Accept       json
// @Produce      json
// @Param        body  body      CreateProviderRequest  true  "Provider definition"
// @Success      201   {object}  domain.ProviderConfig
// @Failure      400   {object}  ErrorResponse
// @Failure      500   {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/providers [post]
func (h *ProviderHandler) CreateProvider(c *fiber.Ctx) error {
	var req CreateProviderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body", "details": err.Error()})
	}
	if err := req.Validate(); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "validation failed", "details": err.Error()})
	}

	now := time.Now()
	pc := &domain.ProviderConfig{
		ID:        uuid.New(),
		Name:      req.Name,
		Channel:   req.Channel,
		Provider:  req.Provider,
		Config:    domain.JSONB(req.Config),
		IsDefault: req.IsDefault,
		IsActive:  true,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := h.store.CreateProviderConfig(c.Context(), pc); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to create provider config", "details": err.Error()})
	}

	// Reload registry so new provider is immediately available
	if err := h.registry.Reload(c.Context()); err != nil {
		// Non-fatal: provider saved, just not live yet
		return c.Status(201).JSON(fiber.Map{
			"data":    pc,
			"warning": "provider saved but registry reload failed: " + err.Error(),
		})
	}

	return c.Status(201).JSON(pc)
}

// ListProviders godoc
// @Summary      List provider configs
// @Description  List all registered provider configurations
// @Tags         providers
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Security     Bearer
// @Router       /api/v1/providers [get]
func (h *ProviderHandler) ListProviders(c *fiber.Ctx) error {
	configs, err := h.store.ListProviderConfigs(c.Context())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to list provider configs", "details": err.Error()})
	}
	if configs == nil {
		configs = []domain.ProviderConfig{}
	}
	return c.JSON(fiber.Map{"data": configs, "total": len(configs)})
}

// GetProvider godoc
// @Summary      Get a provider config
// @Description  Get a provider config by ID
// @Tags         providers
// @Produce      json
// @Param        id  path      string  true  "Provider Config UUID"
// @Success      200  {object}  domain.ProviderConfig
// @Failure      400  {object}  ErrorResponse
// @Failure      404  {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/providers/{id} [get]
func (h *ProviderHandler) GetProvider(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id format"})
	}
	pc, err := h.store.GetProviderConfigByID(c.Context(), id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "provider config not found"})
	}
	return c.JSON(pc)
}

// UpdateProvider godoc
// @Summary      Update a provider config
// @Description  Update an existing provider configuration
// @Tags         providers
// @Accept       json
// @Produce      json
// @Param        id    path      string                  true  "Provider Config UUID"
// @Param        body  body      UpdateProviderRequest   true  "Fields to update"
// @Success      200  {object}  domain.ProviderConfig
// @Failure      400  {object}  ErrorResponse
// @Failure      404  {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/providers/{id} [patch]
func (h *ProviderHandler) UpdateProvider(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id format"})
	}
	pc, err := h.store.GetProviderConfigByID(c.Context(), id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "provider config not found"})
	}

	var req UpdateProviderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body", "details": err.Error()})
	}

	if req.Name != nil {
		pc.Name = *req.Name
	}
	if req.Config != nil {
		pc.Config = domain.JSONB(req.Config)
	}
	if req.IsDefault != nil {
		pc.IsDefault = *req.IsDefault
	}
	if req.IsActive != nil {
		pc.IsActive = *req.IsActive
	}

	if err := h.store.UpdateProviderConfig(c.Context(), pc); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to update provider config", "details": err.Error()})
	}

	// Reload registry
	_ = h.registry.Reload(c.Context())

	return c.JSON(pc)
}

// DeleteProvider godoc
// @Summary      Delete a provider config
// @Description  Delete a provider configuration
// @Tags         providers
// @Produce      json
// @Param        id  path      string  true  "Provider Config UUID"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  ErrorResponse
// @Failure      404  {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/providers/{id} [delete]
func (h *ProviderHandler) DeleteProvider(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id format"})
	}
	if _, err := h.store.GetProviderConfigByID(c.Context(), id); err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "provider config not found"})
	}
	if err := h.store.DeleteProviderConfig(c.Context(), id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to delete provider config", "details": err.Error()})
	}

	// Reload registry to remove deleted provider
	_ = h.registry.Reload(c.Context())

	return c.JSON(fiber.Map{"message": "provider config deleted"})
}
