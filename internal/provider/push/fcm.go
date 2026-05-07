package push

import (
	"context"
	"fmt"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"google.golang.org/api/option"
	"github.com/elight/buzz-service/internal/domain"
)

// FCMProvider implements push notifications via Firebase Cloud Messaging
type FCMProvider struct {
	client *messaging.Client
	config FCMConfig
}

// FCMConfig contains Firebase configuration
type FCMConfig struct {
	CredentialsFile string // path to service-account JSON file
	CredentialsJSON string // inline service-account JSON (takes priority over CredentialsFile)
	ProjectID       string
}

// NewFCMProvider creates a new Firebase Cloud Messaging provider
func NewFCMProvider(ctx context.Context, cfg FCMConfig) (*FCMProvider, error) {
	var opt option.ClientOption
	if cfg.CredentialsJSON != "" {
		opt = option.WithCredentialsJSON([]byte(cfg.CredentialsJSON))
	} else {
		opt = option.WithCredentialsFile(cfg.CredentialsFile)
	}

	app, err := firebase.NewApp(ctx, &firebase.Config{
		ProjectID: cfg.ProjectID,
	}, opt)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize Firebase app: %w", err)
	}

	client, err := app.Messaging(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create FCM client: %w", err)
	}

	return &FCMProvider{
		client: client,
		config: cfg,
	}, nil
}

// Send delivers a notification via push (single device)
func (p *FCMProvider) Send(ctx context.Context, n *domain.Notification) error {
	msg := NotificationToPushMessage(n)
	return p.SendPush(ctx, msg)
}

// SendPush sends a push message to a single device
func (p *FCMProvider) SendPush(ctx context.Context, msg *PushMessage) error {
	fcmMsg := &messaging.Message{
		Token: msg.DeviceToken,
		Notification: &messaging.Notification{
			Title: msg.Title,
			Body:  msg.Body,
		},
		Data: msg.Data,
	}

	// Platform-specific configuration
	if msg.Android != nil {
		fcmMsg.Android = &messaging.AndroidConfig{
			Priority: msg.Android.Priority,
			Notification: &messaging.AndroidNotification{
				Title:       msg.Title,
				Body:        msg.Body,
				Icon:        msg.Android.Icon,
				Color:       msg.Android.Color,
				Sound:       msg.Android.Sound,
				ChannelID:   msg.Android.ChannelID,
				ClickAction: msg.Android.ClickAction,
			},
		}
	}

	if msg.APNS != nil {
		fcmMsg.APNS = &messaging.APNSConfig{
			Headers: map[string]string{
				"apns-priority": msg.APNS.Priority,
			},
			Payload: &messaging.APNSPayload{
				Aps: &messaging.Aps{
					Alert: &messaging.ApsAlert{
						Title: msg.Title,
						Body:  msg.Body,
					},
					Badge:    msg.APNS.Badge,
					Sound:    msg.APNS.Sound,
					Category: msg.APNS.Category,
				},
			},
		}
	}

	if msg.WebPush != nil {
		fcmMsg.Webpush = &messaging.WebpushConfig{
			Headers: map[string]string{
				"Urgency": msg.WebPush.Urgency,
			},
			Notification: &messaging.WebpushNotification{
				Title: msg.Title,
				Body:  msg.Body,
				Icon:  msg.WebPush.Icon,
				Badge: msg.WebPush.Badge,
				Data:  msg.Data,
			},
		}
		if msg.WebPush.RequireInteraction {
			fcmMsg.Webpush.Notification.RequireInteraction = true
		}
	}

	response, err := p.client.Send(ctx, fcmMsg)
	if err != nil {
		return fmt.Errorf("FCM send failed: %w", err)
	}

	_ = response // Message ID available but not needed for this context
	return nil
}

// Name returns the provider name
func (p *FCMProvider) Name() string {
	return "firebase-cloud-messaging"
}

// SupportsChannel checks if provider supports push channel
func (p *FCMProvider) SupportsChannel(channel domain.Channel) bool {
	return channel == domain.ChannelPush
}

// SendToTopic sends a push notification to all devices subscribed to a topic
func (p *FCMProvider) SendToTopic(ctx context.Context, topic string, msg *PushMessage) error {
	fcmMsg := &messaging.Message{
		Topic: topic,
		Notification: &messaging.Notification{
			Title: msg.Title,
			Body:  msg.Body,
		},
		Data: msg.Data,
	}

	response, err := p.client.Send(ctx, fcmMsg)
	if err != nil {
		return fmt.Errorf("FCM topic send failed: %w", err)
	}

	_ = response
	return nil
}

// SubscribeToTopic subscribes device tokens to a topic
func (p *FCMProvider) SubscribeToTopic(ctx context.Context, tokens []string, topic string) error {
	response, err := p.client.SubscribeToTopic(ctx, tokens, topic)
	if err != nil {
		return fmt.Errorf("failed to subscribe to topic: %w", err)
	}

	if response.FailureCount > 0 {
		return fmt.Errorf("topic subscription had %d failures", response.FailureCount)
	}

	return nil
}

// UnsubscribeFromTopic unsubscribes device tokens from a topic
func (p *FCMProvider) UnsubscribeFromTopic(ctx context.Context, tokens []string, topic string) error {
	response, err := p.client.UnsubscribeFromTopic(ctx, tokens, topic)
	if err != nil {
		return fmt.Errorf("failed to unsubscribe from topic: %w", err)
	}

	if response.FailureCount > 0 {
		return fmt.Errorf("topic unsubscription had %d failures", response.FailureCount)
	}

	return nil
}
