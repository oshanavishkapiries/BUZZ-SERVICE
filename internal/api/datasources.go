package api

import (
	"time"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/elight/buzz-service/internal/store"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// DatasourceHandler handles datasource CRUD requests
type DatasourceHandler struct {
	store *store.PostgresStore
}

// NewDatasourceHandler creates a new datasource handler
func NewDatasourceHandler(store *store.PostgresStore) *DatasourceHandler {
	return &DatasourceHandler{store: store}
}

// CreateDatasource godoc
// @Summary      Register a datasource
// @Description  Register an external API endpoint as a datasource for batch jobs
// @Tags         datasources
// @Accept       json
// @Produce      json
// @Param        body  body      CreateDatasourceRequest  true  "Datasource definition"
// @Success      201   {object}  domain.Datasource
// @Failure      400   {object}  ErrorResponse
// @Failure      500   {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/datasources [post]
func (h *DatasourceHandler) CreateDatasource(c *fiber.Ctx) error {
	var req CreateDatasourceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body", "details": err.Error()})
	}
	if req.Name == "" || req.BaseURL == "" {
		return c.Status(400).JSON(fiber.Map{"error": "name and base_url are required"})
	}

	now := time.Now()
	ds := &domain.Datasource{
		ID:         uuid.New(),
		Name:       req.Name,
		BaseURL:    req.BaseURL,
		AuthType:   req.AuthType,
		AuthConfig: req.AuthConfig,
		Endpoints:  req.Endpoints,
		Active:     true,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if err := h.store.CreateDatasource(c.Context(), ds); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to create datasource", "details": err.Error()})
	}
	return c.Status(201).JSON(ds)
}

// ListDatasources godoc
// @Summary      List datasources
// @Description  List all active registered datasources
// @Tags         datasources
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Security     Bearer
// @Router       /api/v1/datasources [get]
func (h *DatasourceHandler) ListDatasources(c *fiber.Ctx) error {
	datasources, err := h.store.ListDatasources(c.Context())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to list datasources", "details": err.Error()})
	}
	if datasources == nil {
		datasources = []domain.Datasource{}
	}
	return c.JSON(fiber.Map{"data": datasources, "total": len(datasources)})
}

// GetDatasource godoc
// @Summary      Get a datasource
// @Description  Get a datasource by ID
// @Tags         datasources
// @Produce      json
// @Param        id  path      string  true  "Datasource UUID"
// @Success      200  {object}  domain.Datasource
// @Failure      400  {object}  ErrorResponse
// @Failure      404  {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/datasources/{id} [get]
func (h *DatasourceHandler) GetDatasource(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id format"})
	}
	ds, err := h.store.GetDatasourceByID(c.Context(), id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "datasource not found"})
	}
	return c.JSON(ds)
}

// UpdateDatasource godoc
// @Summary      Update a datasource
// @Description  Update an existing datasource's configuration
// @Tags         datasources
// @Accept       json
// @Produce      json
// @Param        id    path      string                   true  "Datasource UUID"
// @Param        body  body      UpdateDatasourceRequest  true  "Fields to update"
// @Success      200  {object}  domain.Datasource
// @Failure      400  {object}  ErrorResponse
// @Failure      404  {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/datasources/{id} [patch]
func (h *DatasourceHandler) UpdateDatasource(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id format"})
	}
	ds, err := h.store.GetDatasourceByID(c.Context(), id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "datasource not found"})
	}

	var req UpdateDatasourceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body", "details": err.Error()})
	}

	if req.BaseURL != nil {
		ds.BaseURL = *req.BaseURL
	}
	if req.AuthType != nil {
		ds.AuthType = *req.AuthType
	}
	if req.AuthConfig != nil {
		ds.AuthConfig = req.AuthConfig
	}
	if req.Endpoints != nil {
		ds.Endpoints = req.Endpoints
	}
	ds.UpdatedAt = time.Now()

	if err := h.store.UpdateDatasource(c.Context(), ds); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to update datasource", "details": err.Error()})
	}
	return c.JSON(ds)
}

// DeleteDatasource godoc
// @Summary      Delete a datasource
// @Description  Deactivate a datasource (soft delete)
// @Tags         datasources
// @Produce      json
// @Param        id  path      string  true  "Datasource UUID"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  ErrorResponse
// @Failure      404  {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/datasources/{id} [delete]
func (h *DatasourceHandler) DeleteDatasource(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id format"})
	}
	if _, err := h.store.GetDatasourceByID(c.Context(), id); err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "datasource not found"})
	}
	if err := h.store.DeleteDatasource(c.Context(), id); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to delete datasource"})
	}
	return c.JSON(fiber.Map{"message": "datasource deactivated"})
}
