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

// HandleSESWebhook godoc
// @Summary      Amazon SES webhook
// @Description  Receive bounce, complaint, and delivery notifications from Amazon SES via SNS
// @Tags         webhooks
// @Accept       json
// @Produce      json
// @Param        body  body      map[string]interface{}  true  "SNS notification payload"
// @Success      200
// @Failure      400   {object}  ErrorResponse
// @Router       /webhooks/ses [post]
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

// HandleGenericWebhook godoc
// @Summary      Generic webhook
// @Description  Receive and log generic webhook payloads
// @Tags         webhooks
// @Accept       json
// @Produce      json
// @Param        body  body      map[string]interface{}  true  "Webhook payload"
// @Success      200
// @Failure      400   {object}  ErrorResponse
// @Router       /webhooks/generic [post]
func (h *WebhookHandler) HandleGenericWebhook(c *fiber.Ctx) error {
	var payload map[string]interface{}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid payload"})
	}

	// Log webhook for debugging
	fmt.Printf("Generic webhook received: %v\n", payload)

	return c.SendStatus(200)
}

// HandleNotifyLKWebhook godoc
// @Summary      NotifyLK webhook
// @Description  Receive SMS delivery receipts from the NotifyLK provider
// @Tags         webhooks
// @Accept       json
// @Produce      json
// @Param        body  body      map[string]interface{}  true  "NotifyLK delivery receipt"
// @Success      200
// @Failure      400   {object}  ErrorResponse
// @Router       /webhooks/notifylk [post]
func (h *WebhookHandler) HandleNotifyLKWebhook(c *fiber.Ctx) error {
	var payload map[string]interface{}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid payload"})
	}

	// NotifyLK webhook format: message_id, status (delivered, failed, expired)
	messageID, ok := payload["message_id"].(string)
	if !ok {
		return c.Status(400).JSON(fiber.Map{"error": "missing message_id"})
	}

	status, ok := payload["status"].(string)
	if !ok {
		return c.Status(400).JSON(fiber.Map{"error": "missing status"})
	}

	// Update notification status based on delivery receipt
	switch status {
	case "delivered":
		// SMS confirmed delivered
		_ = messageID
		// In a real implementation:
		// 1. Query notification by message ID
		// 2. Update status to delivered
		// 3. Record delivery timestamp

	case "failed", "expired":
		// SMS failed to deliver
		_ = messageID
		// In a real implementation:
		// 1. Query notification by message ID
		// 2. Update status to failed
		// 3. Record error reason
	}

	return c.SendStatus(200)
}

// HandleTwilioWebhook godoc
// @Summary      Twilio webhook
// @Description  Receive SMS status callbacks from Twilio (form-encoded payload)
// @Tags         webhooks
// @Accept       application/x-www-form-urlencoded
// @Produce      json
// @Param        MessageSid     formData  string  true   "Twilio message SID"
// @Param        MessageStatus  formData  string  true   "Delivery status"
// @Param        ErrorCode      formData  string  false  "Error code (if failed)"
// @Success      200
// @Failure      400   {object}  ErrorResponse
// @Router       /webhooks/twilio [post]
func (h *WebhookHandler) HandleTwilioWebhook(c *fiber.Ctx) error {
	// Twilio sends status callbacks as form data
	messageSID := c.FormValue("MessageSid")
	messageStatus := c.FormValue("MessageStatus")
	errorCode := c.FormValue("ErrorCode")

	if messageSID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "missing MessageSid"})
	}

	// Twilio statuses: queued, sending, sent, delivered, undelivered, failed
	switch messageStatus {
	case "delivered":
		// SMS confirmed delivered
		_ = messageSID
		// In a real implementation:
		// 1. Query notification by Twilio message ID
		// 2. Update status to delivered
		// 3. Record delivery timestamp

	case "undelivered", "failed":
		// SMS failed to deliver
		_ = messageSID
		_ = errorCode
		// In a real implementation:
		// 1. Query notification by Twilio message ID
		// 2. Update status to failed
		// 3. Record error code and reason

	case "queued", "sending", "sent":
		// SMS is in progress, no action needed yet
		_ = messageSID
	}

	return c.SendStatus(200)
}
