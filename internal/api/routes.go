package api

import (
	"fmt"

	"github.com/elight/buzz-service/internal/config"
	"github.com/elight/buzz-service/internal/queue"
	"github.com/elight/buzz-service/internal/realtime"
	"github.com/elight/buzz-service/internal/store"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
)

func SetupRoutes(app *fiber.App, db *store.PostgresStore, producer *queue.Producer, cfg *config.Config, gateway *realtime.Gateway) {
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

	// Webhook routes (public, no auth required)
	webhookHandler := NewWebhookHandler(db)
	webhooks := app.Group("/webhooks")
	webhooks.Post("/ses", webhookHandler.HandleSESWebhook)
	webhooks.Post("/notifylk", webhookHandler.HandleNotifyLKWebhook)
	webhooks.Post("/twilio", webhookHandler.HandleTwilioWebhook)
	webhooks.Post("/generic", webhookHandler.HandleGenericWebhook)

	// API v1 routes
	v1 := app.Group("/api/v1")

	// Authenticated routes
	v1.Use(AuthMiddleware(db))

	// Notifications
	notifHandler := NewNotificationHandler(db, producer)
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

	// Batch notifications
	batchHandler := NewBatchHandler(db, producer)
	batches := v1.Group("/batches")
	batches.Post("/send", RequireScope("batch:send"), batchHandler.SendBulk)
	batches.Get("/:id", RequireScope("batch:read"), batchHandler.GetBatchStatus)
	batches.Get("/", RequireScope("batch:read"), batchHandler.ListBatches)

	// Monitoring
	redisAddr := fmt.Sprintf("%s:%d", cfg.Redis.Host, cfg.Redis.Port)
	inspector := queue.NewInspector(redisAddr, cfg.Redis.Password)
	monitoringHandler := NewMonitoringHandler(inspector)
	monitoring := v1.Group("/monitoring")
	monitoring.Get("/queues", RequireScope("monitoring:read"), monitoringHandler.ListQueues)
	monitoring.Get("/queues/:queue", RequireScope("monitoring:read"), monitoringHandler.GetQueueStats)
	monitoring.Get("/stats", RequireScope("monitoring:read"), monitoringHandler.GetAllQueueStats)
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
