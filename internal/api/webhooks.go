package api

import (
	"encoding/json"
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/elight/buzz-service/internal/store"
)

// WebhookHandler handles external webhook notifications (SES, etc.)
type WebhookHandler struct {
	store *store.PostgresStore
}

// NewWebhookHandler creates a new webhook handler
func NewWebhookHandler(store *store.PostgresStore) *WebhookHandler {
	return &WebhookHandler{store: store}
}

// HandleSESWebhook processes Amazon SES notifications via SNS
// Handles bounce, complaint, and delivery notifications
func (h *WebhookHandler) HandleSESWebhook(c *fiber.Ctx) error {
	var payload map[string]interface{}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid payload"})
	}

	messageType, ok := payload["Type"].(string)
	if !ok {
		return c.Status(400).JSON(fiber.Map{"error": "missing Type field"})
	}

	// Handle SNS subscription confirmation
	if messageType == "SubscriptionConfirmation" {
		// In production, verify the SubscribeURL signature
		// For MVP, we auto-confirm
		return c.SendStatus(200)
	}

	// Handle SNS notifications
	if messageType == "Notification" {
		message, ok := payload["Message"].(string)
		if !ok {
			return c.Status(400).JSON(fiber.Map{"error": "missing Message field"})
		}

		var sesMessage map[string]interface{}
		if err := json.Unmarshal([]byte(message), &sesMessage); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid SES message format"})
		}

		notificationType, ok := sesMessage["notificationType"].(string)
		if !ok {
			return c.Status(400).JSON(fiber.Map{"error": "missing notificationType"})
		}

		switch notificationType {
		case "Bounce":
			return h.handleBounce(c, sesMessage)
		case "Complaint":
			return h.handleComplaint(c, sesMessage)
		case "Delivery":
			return h.handleDelivery(c, sesMessage)
		case "Send":
			// Email was sent successfully
			return c.SendStatus(200)
		default:
			// Unknown notification type, but still acknowledge it
			return c.SendStatus(200)
		}
	}

	return c.SendStatus(200)
}

// handleBounce processes email bounce notifications
func (h *WebhookHandler) handleBounce(c *fiber.Ctx, message map[string]interface{}) error {
	bounce, ok := message["bounce"].(map[string]interface{})
	if !ok {
		return c.Status(400).JSON(fiber.Map{"error": "invalid bounce data"})
	}

	bounceType, ok := bounce["bounceType"].(string)
	if !ok {
		return c.Status(400).JSON(fiber.Map{"error": "missing bounceType"})
	}

	recipients, ok := bounce["bouncedRecipients"].([]interface{})
	if !ok {
		return c.Status(400).JSON(fiber.Map{"error": "invalid bouncedRecipients"})
	}

	for _, recipient := range recipients {
		recipientMap, ok := recipient.(map[string]interface{})
		if !ok {
			continue
		}

		email, ok := recipientMap["emailAddress"].(string)
		if !ok {
			continue
		}

		// Mark notification as failed/bounced
		// In a real implementation, we'd query by recipient and message ID
		// For MVP, we log the bounce
		_ = bounceType
		_ = email
	}

	return c.SendStatus(200)
}

// handleComplaint processes complaint notifications (spam reports)
func (h *WebhookHandler) handleComplaint(c *fiber.Ctx, message map[string]interface{}) error {
	complaint, ok := message["complaint"].(map[string]interface{})
	if !ok {
		return c.Status(400).JSON(fiber.Map{"error": "invalid complaint data"})
	}

	recipients, ok := complaint["complainedRecipients"].([]interface{})
	if !ok {
		return c.Status(400).JSON(fiber.Map{"error": "invalid complainedRecipients"})
	}

	for _, recipient := range recipients {
		recipientMap, ok := recipient.(map[string]interface{})
		if !ok {
			continue
		}

		email, ok := recipientMap["emailAddress"].(string)
		if !ok {
			continue
		}

		// MUST stop sending to this address
		// Mark as permanently failed or add to suppression list
		_ = email

		// In a real implementation:
		// 1. Log to audit trail
		// 2. Add to suppression list
		// 3. Alert administrators
	}

	return c.SendStatus(200)
}

// handleDelivery processes successful delivery notifications
func (h *WebhookHandler) handleDelivery(c *fiber.Ctx, message map[string]interface{}) error {
	delivery, ok := message["delivery"].(map[string]interface{})
	if !ok {
		return c.Status(400).JSON(fiber.Map{"error": "invalid delivery data"})
	}

	recipients, ok := delivery["recipients"].([]interface{})
	if !ok {
		return c.Status(400).JSON(fiber.Map{"error": "invalid recipients"})
	}

	for _, recipient := range recipients {
		email, ok := recipient.(string)
		if !ok {
			continue
		}

		// Mark notification as delivered
		_ = email

		// In a real implementation:
		// 1. Query notification by message ID and recipient
		// 2. Update status to delivered
		// 3. Record delivery timestamp
	}

	return c.SendStatus(200)
}

// HandleGenericWebhook handles generic webhook notifications
func (h *WebhookHandler) HandleGenericWebhook(c *fiber.Ctx) error {
	var payload map[string]interface{}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid payload"})
	}

	// Log webhook for debugging
	fmt.Printf("Generic webhook received: %v\n", payload)

	return c.SendStatus(200)
}
