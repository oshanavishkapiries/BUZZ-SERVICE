package api

import (
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

// CreateTemplate handles POST /api/v1/templates
func (h *TemplateHandler) CreateTemplate(c *fiber.Ctx) error {
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

	// Build channels array
	var channels []string
	if req.Channel != "" {
		channels = []string{string(req.Channel)}
	}

	// Create template
	subjectPtr := &req.Subject
	if req.Subject == "" {
		subjectPtr = nil
	}

	template := &domain.Template{
		ID:        uuid.New(),
		Name:      req.Name,
		Channels:  channels,
		Subject:   subjectPtr,
		Body:      req.Body,
		IsActive:  true,
		Config:    req.Metadata,
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

// GetTemplate handles GET /api/v1/templates/:name
func (h *TemplateHandler) GetTemplate(c *fiber.Ctx) error {
	name := c.Params("name")

	repo := store.NewTemplateRepository(h.store.DB())
	template, err := repo.GetByName(c.Context(), name)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{
			"error": "template not found",
		})
	}

	return c.JSON(template)
}

// ListTemplates handles GET /api/v1/templates
func (h *TemplateHandler) ListTemplates(c *fiber.Ctx) error {
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
	templates, err := repo.List(c.Context(), filters, limit, offset)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"error":   "failed to fetch templates",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"data":  templates,
		"total": len(templates),
		"limit": limit,
		"offset": offset,
	})
}

// UpdateTemplate handles PATCH /api/v1/templates/:name
func (h *TemplateHandler) UpdateTemplate(c *fiber.Ctx) error {
	name := c.Params("name")

	var req UpdateTemplateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error":   "invalid request body",
			"details": err.Error(),
		})
	}

	// Get existing template
	repo := store.NewTemplateRepository(h.store.DB())
	template, err := repo.GetByName(c.Context(), name)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{
			"error": "template not found",
		})
	}

	// Update fields if provided
	if req.Subject != nil {
		template.Subject = req.Subject
	}
	if req.Body != nil {
		template.Body = *req.Body
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
