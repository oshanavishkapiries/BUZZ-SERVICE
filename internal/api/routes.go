package api

import (
	"github.com/elight/buzz-service/internal/store"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func SetupRoutes(app *fiber.App, db *store.PostgresStore) {
	// Global middleware
	app.Use(recover.New())
	app.Use(cors.New())

	// Health check
	app.Get("/health", HealthCheck(db))

	// API v1 routes
	v1 := app.Group("/api/v1")
	v1.Get("/health", HealthCheck(db))
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
