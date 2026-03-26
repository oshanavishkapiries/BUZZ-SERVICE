package push

import (
	"github.com/elight/buzz-service/internal/domain"
)

// PushMessage represents a push notification message
type PushMessage struct {
	DeviceToken string
	Title       string
	Body        string
	Data        map[string]string

	// Platform-specific configs
	Android *AndroidConfig
	APNS    *APNSConfig
	WebPush *WebPushConfig
}

// AndroidConfig contains Android-specific notification settings
type AndroidConfig struct {
	Priority    string // "high" or "normal"
	Icon        string
	Color       string // Hex color: #RRGGBB
	Sound       string
	ChannelID   string
	ClickAction string // Deep link
}

// APNSConfig contains Apple Push Notification Service settings
type APNSConfig struct {
	Priority string // "10" (immediate) or "5" (power-saving)
	Badge    *int
	Sound    string
	Category string // For action buttons
}

// WebPushConfig contains Web Push settings
type WebPushConfig struct {
	Icon               string
	Badge              string
	Urgency            string // "very-low", "low", "normal", "high"
	RequireInteraction bool
}

// NotificationToPushMessage converts a domain Notification to a PushMessage
func NotificationToPushMessage(n *domain.Notification) *PushMessage {
	// Extract device token from recipient
	deviceToken := ""
	if n.Recipient != nil {
		if token, ok := n.Recipient["token"].(string); ok {
			deviceToken = token
		}
	}

	title := ""
	if n.Subject != nil {
		title = *n.Subject
	}

	msg := &PushMessage{
		DeviceToken: deviceToken,
		Title:       title,
		Body:        n.Body,
		Data:        make(map[string]string),
	}

	// Extract metadata for deep linking from Variables
	if n.Variables != nil {
		if actionURL, ok := n.Variables["action_url"].(string); ok {
			msg.Data["action_url"] = actionURL
		}
		if screen, ok := n.Variables["screen"].(string); ok {
			msg.Data["screen"] = screen
		}
	}

	// Add notification metadata
	msg.Data["notification_id"] = n.ID.String()
	msg.Data["created_at"] = n.CreatedAt.Format("2006-01-02T15:04:05Z")

	// Set default platform configs based on priority
	if n.Priority == domain.PriorityHigh || n.Priority == domain.PriorityUrgent {
		msg.Android = &AndroidConfig{
			Priority:  "high",
			ChannelID: "high_priority",
		}
		msg.APNS = &APNSConfig{
			Priority: "10",
		}
		msg.WebPush = &WebPushConfig{
			Urgency:            "high",
			RequireInteraction: true,
		}
	} else {
		msg.Android = &AndroidConfig{
			Priority:  "normal",
			ChannelID: "default",
		}
		msg.APNS = &APNSConfig{
			Priority: "5",
		}
		msg.WebPush = &WebPushConfig{
			Urgency: "normal",
		}
	}

	return msg
}
