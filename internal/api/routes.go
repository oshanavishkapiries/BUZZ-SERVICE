package api

import (
	"github.com/elight/buzz-service/internal/config"
	"github.com/elight/buzz-service/internal/provider"
	"github.com/elight/buzz-service/internal/queue"
	"github.com/elight/buzz-service/internal/realtime"
	"github.com/elight/buzz-service/internal/store"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	swagger "github.com/gofiber/swagger"
)

func SetupRoutes(app *fiber.App, db *store.PostgresStore, producer *queue.Producer, cfg *config.Config, gateway *realtime.Gateway, registry *provider.Registry) {
	// Global middleware
	app.Use(recover.New())
	app.Use(requestid.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowMethods:     "GET,POST,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,X-User-ID",
		AllowCredentials: false,
	}))

	// Public health check
	app.Get("/health", HealthCheck(db))

	// Swagger UI (public documentation)
	app.Get("/swagger/*", swagger.New(swagger.Config{
		DocExpansion: "none",
	}))

	// Webhook routes (public, no auth required)
	webhookHandler := NewWebhookHandler(db)
	webhooks := app.Group("/webhooks")
	webhooks.Post("/ses", webhookHandler.HandleSESWebhook)
	webhooks.Post("/textlk", webhookHandler.HandleTextLKWebhook)
	webhooks.Post("/twilio", webhookHandler.HandleTwilioWebhook)
	webhooks.Post("/generic", webhookHandler.HandleGenericWebhook)

	// API v1 routes
	v1 := app.Group("/api/v1")

	// Public Auth Endpoints (No Auth Needed)
	authHandler := NewAuthHandler(db, cfg.Server.JWTSecret)
	v1.Post("/auth/signup", authHandler.Signup)
	v1.Post("/auth/login", authHandler.Login)

	// Authenticated routes
	v1.Use(AuthMiddleware(db, cfg.Server.JWTSecret))

	// Authenticated user profile
	v1.Get("/auth/me", authHandler.Me)

	// Applications and API keys management (authenticated by JWT session)
	appHandler := NewApplicationHandler(db)
	v1.Get("/applications", appHandler.ListApplications)
	v1.Post("/applications", appHandler.CreateApplication)
	v1.Get("/applications/:appId/keys", appHandler.ListAPIKeys)
	v1.Post("/applications/:appId/keys", appHandler.CreateAPIKey)
	v1.Delete("/applications/:appId/keys/:keyId", appHandler.DeleteAPIKey)

	// Notifications
	notifHandler := NewNotificationHandler(db, producer, gateway)
	notifications := v1.Group("/notifications")
	notifications.Post("/", RequireScope("notification:send"), notifHandler.SendNotification)
	notifications.Get("/", RequireScope("notification:read"), notifHandler.ListNotifications)
	notifications.Get("/matrix", RequireScope("notification:read"), notifHandler.GetMatrix)
	notifications.Get("/:id", RequireScope("notification:read"), notifHandler.GetNotification)

	// Templates
	templateHandler := NewTemplateHandler(db)
	templates := v1.Group("/templates")
	templates.Post("/", RequireScope("template:write"), templateHandler.CreateTemplate)
	templates.Get("/", RequireScope("template:read"), templateHandler.ListTemplates)
	templates.Get("/:name", RequireScope("template:read"), templateHandler.GetTemplate)
	templates.Patch("/:name", RequireScope("template:write"), templateHandler.UpdateTemplate)
	templates.Delete("/:name", RequireScope("template:write"), templateHandler.DeleteTemplate)

	// Devices (push notification device management)
	deviceHandler := NewDeviceHandler(db)
	devices := v1.Group("/devices")
	devices.Post("/register", RequireScope("device:write"), deviceHandler.RegisterDevice)
	devices.Get("/", RequireScope("device:read"), deviceHandler.ListUserDevices)
	devices.Delete("/:token", RequireScope("device:write"), deviceHandler.UnregisterDevice)

	// Inbox (in-app notifications)
	inboxHandler := NewInboxHandler(db)
	inbox := v1.Group("/inbox")
	inbox.Get("/", inboxHandler.GetInbox)
	inbox.Patch("/:id/read", inboxHandler.MarkAsRead)
	inbox.Post("/read-all", inboxHandler.MarkAllAsRead)
	inbox.Delete("/:id", inboxHandler.DeleteNotification)

	// Real-time notifications (SSE stream)
	v1.Get("/stream", gateway.HandleSSEConnection)
	v1.Get("/stream/stats", func(c *fiber.Ctx) error {
		stats := gateway.GetStats()
		return c.JSON(fiber.Map{
			"online_users":      stats["total_users"],
			"total_connections": stats["total_connections"],
		})
	})

	// Datasources (external API registrations for batch jobs)
	datasourceHandler := NewDatasourceHandler(db)
	datasources := v1.Group("/datasources")
	datasources.Post("/", RequireScope("batch:send"), datasourceHandler.CreateDatasource)
	datasources.Get("/", RequireScope("batch:read"), datasourceHandler.ListDatasources)
	datasources.Get("/:id", RequireScope("batch:read"), datasourceHandler.GetDatasource)
	datasources.Patch("/:id", RequireScope("batch:send"), datasourceHandler.UpdateDatasource)
	datasources.Delete("/:id", RequireScope("batch:send"), datasourceHandler.DeleteDatasource)

	// Batch notifications
	batchHandler := NewBatchHandler(db, producer)
	batches := v1.Group("/batches")
	batches.Post("/send", RequireScope("batch:send"), batchHandler.SendBulk)
	batches.Get("/:id", RequireScope("batch:read"), batchHandler.GetBatchStatus)
	batches.Get("/", RequireScope("batch:read"), batchHandler.ListBatches)

	// Provider configs (notification delivery providers)
	providerHandler := NewProviderHandler(db, registry)
	providers := v1.Group("/providers")
	providers.Post("/", RequireScope("notification:send"), providerHandler.CreateProvider)
	providers.Get("/", RequireScope("notification:read"), providerHandler.ListProviders)
	providers.Get("/:id", RequireScope("notification:read"), providerHandler.GetProvider)
	providers.Patch("/:id", RequireScope("notification:send"), providerHandler.UpdateProvider)
	providers.Delete("/:id", RequireScope("notification:send"), providerHandler.DeleteProvider)
}

// HealthCheck godoc
// @Summary      Health check
// @Description  Returns service health status including database connectivity
// @Tags         health
// @Produce      json
// @Success      200  {object}  map[string]interface{}  "Service is healthy"
// @Failure      503  {object}  map[string]interface{}  "Service is unhealthy"
// @Router       /health [get]
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
