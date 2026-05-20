package api

import (
	"net/url"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/elight/buzz-service/internal/store"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// TemplateHandler handles template-related HTTP requests
type TemplateHandler struct {
	store *store.PostgresStore
}

// NewTemplateHandler creates a new template handler
func NewTemplateHandler(store *store.PostgresStore) *TemplateHandler {
	return &TemplateHandler{
		store: store,
	}
}

// CreateTemplate godoc
// @Summary      Create a template
// @Description  Create a reusable notification template with optional variable placeholders
// @Tags         templates
// @Accept       json
// @Produce      json
// @Param        body  body      CreateTemplateRequest  true  "Template definition"
// @Success      201   {object}  domain.Template
// @Failure      400   {object}  ErrorResponse
// @Failure      500   {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/templates [post]
func (h *TemplateHandler) CreateTemplate(c *fiber.Ctx) error {
	appID, err := GetApplicationID(c)
	if err != nil {
		return err
	}

	var req CreateTemplateRequest
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

	channels := req.ResolvedChannels()

	// Create template
	subjectPtr := &req.Subject
	if req.Subject == "" {
		subjectPtr = nil
	}

	// Ensure variables is not nil (database has NOT NULL constraint)
	variables := req.Variables
	if variables == nil {
		variables = []string{}
	}

	template := &domain.Template{
		ID:            uuid.New(),
		ApplicationID: appID,
		Name:          req.Name,
		Channels:      channels,
		Subject:       subjectPtr,
		Body:          req.Body,
		Variables:     variables,
		IsActive:      true,
		Config:        req.Metadata,
	}

	repo := store.NewTemplateRepository(h.store.DB())
	if err := repo.Create(c.Context(), template); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "failed to create template",
			"details": err.Error(),
		})
	}

	return c.Status(201).JSON(template)
}

// GetTemplate godoc
// @Summary      Get a template
// @Description  Retrieve a template by name
// @Tags         templates
// @Produce      json
// @Param        name  path      string  true  "Template name"
// @Success      200   {object}  domain.Template
// @Failure      404   {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/templates/{name} [get]
func (h *TemplateHandler) GetTemplate(c *fiber.Ctx) error {
	appID, err := GetApplicationID(c)
	if err != nil {
		return err
	}

	name, _ := url.PathUnescape(c.Params("name"))

	repo := store.NewTemplateRepository(h.store.DB())
	template, err := repo.GetByName(c.Context(), appID, name)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{
			"error": "template not found",
		})
	}

	return c.JSON(template)
}

// ListTemplates godoc
// @Summary      List templates
// @Description  Retrieve a paginated list of notification templates with optional filters
// @Tags         templates
// @Produce      json
// @Param        channel  query     string  false  "Filter by channel (email, sms, push, in_app)"
// @Param        active   query     bool    false  "Filter by active status (default true)"
// @Param        limit    query     int     false  "Page size (default 50)"
// @Param        offset   query     int     false  "Page offset (default 0)"
// @Success      200      {object}  map[string]interface{}
// @Failure      500      {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/templates [get]
func (h *TemplateHandler) ListTemplates(c *fiber.Ctx) error {
	appID, err := GetApplicationID(c)
	if err != nil {
		return err
	}

	// Parse query parameters
	channel := c.Query("channel")
	activeOnly := c.QueryBool("active", true)
	limit := c.QueryInt("limit", 50)
	offset := c.QueryInt("offset", 0)

	// Build filters
	filters := map[string]interface{}{
		"is_active": activeOnly,
	}
	if channel != "" {
		filters["channel"] = channel
	}

	repo := store.NewTemplateRepository(h.store.DB())
	templates, err := repo.List(c.Context(), appID, filters, limit, offset)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "failed to fetch templates",
			"details": err.Error(),
		})
	}

	// Get total count
	total, err := repo.Count(c.Context(), appID, filters)
	if err != nil {
		total = len(templates) // fallback to returned count if count fails
	}

	return c.JSON(fiber.Map{
		"data":   templates,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// UpdateTemplate godoc
// @Summary      Update a template
// @Description  Partially update an existing template's subject, body, metadata, or active status
// @Tags         templates
// @Accept       json
// @Produce      json
// @Param        name  path      string                 true  "Template name"
// @Param        body  body      UpdateTemplateRequest  true  "Fields to update"
// @Success      200   {object}  map[string]interface{}
// @Failure      400   {object}  ErrorResponse
// @Failure      404   {object}  ErrorResponse
// @Failure      500   {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/templates/{name} [patch]
func (h *TemplateHandler) UpdateTemplate(c *fiber.Ctx) error {
	appID, err := GetApplicationID(c)
	if err != nil {
		return err
	}

	name, _ := url.PathUnescape(c.Params("name"))

	var req UpdateTemplateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error":   "invalid request body",
			"details": err.Error(),
		})
	}

	// Get existing template
	repo := store.NewTemplateRepository(h.store.DB())
	template, err := repo.GetByName(c.Context(), appID, name)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{
			"error": "template not found",
		})
	}

	// Update fields if provided
	if len(req.Channels) > 0 {
		template.Channels = req.Channels
	}
	if req.Subject != nil {
		template.Subject = req.Subject
	}
	if req.Body != nil {
		template.Body = *req.Body
	}
	if req.Variables != nil {
		template.Variables = req.Variables
	}
	if req.Metadata != nil {
		template.Config = req.Metadata
	}
	if req.Active != nil {
		template.IsActive = *req.Active
	}

	// Save changes
	if err := repo.Update(c.Context(), template); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "failed to update template",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "template updated successfully",
		"data":    template,
	})
}

// DeleteTemplate godoc
// @Summary      Delete a template
// @Description  Delete a template by name (soft delete)
// @Tags         templates
// @Produce      json
// @Param        name  path      string  true  "Template name"
// @Success      200   {object}  map[string]interface{}
// @Failure      404   {object}  ErrorResponse
// @Failure      500   {object}  ErrorResponse
// @Security     Bearer
// @Router       /api/v1/templates/{name} [delete]
func (h *TemplateHandler) DeleteTemplate(c *fiber.Ctx) error {
	appID, err := GetApplicationID(c)
	if err != nil {
		return err
	}

	name, _ := url.PathUnescape(c.Params("name"))

	repo := store.NewTemplateRepository(h.store.DB())
	// First get the template to get its ID
	template, err := repo.GetByName(c.Context(), appID, name)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{
			"error": "template not found",
		})
	}

	// Delete by ID
	if err := repo.Delete(c.Context(), appID, template.ID); err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error": "failed to delete template",
		})
	}

	return c.JSON(fiber.Map{
		"message": "template deleted successfully",
	})
}
