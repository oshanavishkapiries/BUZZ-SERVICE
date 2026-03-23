package api

import (
	"github.com/elight/buzz-service/internal/store"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
)

func SetupRoutes(app *fiber.App, db *store.PostgresStore) {
	// Global middleware
	app.Use(recover.New())
	app.Use(requestid.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowMethods:     "GET,POST,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowCredentials: false,
	}))

	// Public health check
	app.Get("/health", HealthCheck(db))

	// API v1 routes
	v1 := app.Group("/api/v1")

	// Authenticated routes
	v1.Use(AuthMiddleware(db))

	// Notifications
	notifHandler := NewNotificationHandler(db)
	notifications := v1.Group("/notifications")
	notifications.Post("/", RequireScope("notification:send"), notifHandler.SendNotification)
	notifications.Get("/", RequireScope("notification:read"), notifHandler.ListNotifications)
	notifications.Get("/:id", RequireScope("notification:read"), notifHandler.GetNotification)

	// Templates
	templateHandler := NewTemplateHandler(db)
	templates := v1.Group("/templates")
	templates.Post("/", RequireScope("template:write"), templateHandler.CreateTemplate)
	templates.Get("/", RequireScope("template:read"), templateHandler.ListTemplates)
	templates.Get("/:name", RequireScope("template:read"), templateHandler.GetTemplate)
	templates.Patch("/:name", RequireScope("template:write"), templateHandler.UpdateTemplate)
}

func HealthCheck(db *store.PostgresStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ctx := c.Context()

		// Check database
		if err := db.Health(ctx); err != nil {
			return c.Status(503).JSON(fiber.Map{
				"status": "unhealthy",
				"checks": fiber.Map{
					"database": "down",
				},
				"error": err.Error(),
			})
		}

		return c.JSON(fiber.Map{
			"status":  "healthy",
			"version": "1.0.0",
			"checks": fiber.Map{
				"database": "up",
			},
		})
	}
}
