# Phase 07: Push Notification Provider (FCM)

## Objectives
- Implement Firebase Cloud Messaging (FCM) provider
- Support web push notifications
- Support mobile push (Android + iOS)
- Handle device token management
- Implement topic-based messaging
- Add notification actions and deep links
- Handle push notification analytics

---

## 7.1 FCM Provider Setup

```go
// internal/provider/push/fcm.go
package push

import (
    "context"
    "fmt"

    firebase "firebase.google.com/go/v4"
    "firebase.google.com/go/v4/messaging"
    "google.golang.org/api/option"
    "buzz-service/internal/domain"
    "buzz-service/internal/provider"
)

type FCMProvider struct {
    client *messaging.Client
    config FCMConfig
}

type FCMConfig struct {
    CredentialsFile string // Path to Firebase service account JSON
    ProjectID       string
}

func NewFCMProvider(ctx context.Context, cfg FCMConfig) (*FCMProvider, error) {
    opt := option.WithCredentialsFile(cfg.CredentialsFile)
    
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

func (p *FCMProvider) Send(ctx context.Context, n *domain.Notification) error {
    msg := NotificationToPushMessage(n)
    return p.SendPush(ctx, msg)
}

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
                Title:        msg.Title,
                Body:         msg.Body,
                Icon:         msg.Android.Icon,
                Color:        msg.Android.Color,
                Sound:        msg.Android.Sound,
                ChannelID:    msg.Android.ChannelID,
                ClickAction:  msg.Android.ClickAction,
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
                    Badge:  msg.APNS.Badge,
                    Sound:  msg.APNS.Sound,
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

    // Send message
    response, err := p.client.Send(ctx, fcmMsg)
    if err != nil {
        return fmt.Errorf("FCM send failed: %w", err)
    }

    // response contains message ID
    _ = response // e.g., "projects/myproject/messages/1234567890"

    return nil
}

func (p *FCMProvider) Name() string {
    return "firebase-cloud-messaging"
}

func (p *FCMProvider) SupportsChannel(channel domain.Channel) bool {
    return channel == domain.ChannelPush
}
```

---

## 7.2 Push Message Types

```go
// internal/provider/push/types.go
package push

import (
    "buzz-service/internal/domain"
)

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

type AndroidConfig struct {
    Priority    string // "high" or "normal"
    Icon        string
    Color       string // Hex color: #RRGGBB
    Sound       string
    ChannelID   string
    ClickAction string // Deep link
}

type APNSConfig struct {
    Priority string // "10" (immediate) or "5" (power-saving)
    Badge    *int
    Sound    string
    Category string // For action buttons
}

type WebPushConfig struct {
    Icon               string
    Badge              string
    Urgency            string // "very-low", "low", "normal", "high"
    RequireInteraction bool
}

func NotificationToPushMessage(n *domain.Notification) *PushMessage {
    msg := &PushMessage{
        DeviceToken: n.ToAddress,
        Title:       n.Subject,
        Body:        n.Body,
        Data:        make(map[string]string),
    }

    // Extract metadata for deep linking
    if n.TemplateData != nil {
        if actionURL, ok := n.TemplateData["action_url"].(string); ok {
            msg.Data["action_url"] = actionURL
        }
        if screen, ok := n.TemplateData["screen"].(string); ok {
            msg.Data["screen"] = screen
        }
    }

    // Add notification metadata
    msg.Data["notification_id"] = n.ID.String()
    msg.Data["created_at"] = n.CreatedAt.Format("2006-01-02T15:04:05Z")

    // Set default platform configs based on priority
    if n.Priority == domain.PriorityHigh {
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
```

---

## 7.3 Topic-Based Messaging

```go
// internal/provider/push/topics.go
package push

import (
    "context"
    "fmt"
    
    "firebase.google.com/go/v4/messaging"
)

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

    // Check for partial failures
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
```

---

## 7.4 Multicast (Batch Push)

```go
// internal/provider/push/multicast.go
package push

import (
    "context"
    "fmt"
    
    "firebase.google.com/go/v4/messaging"
)

// SendMulticast sends the same notification to multiple devices
func (p *FCMProvider) SendMulticast(ctx context.Context, tokens []string, msg *PushMessage) (*MulticastResult, error) {
    if len(tokens) == 0 {
        return nil, fmt.Errorf("no device tokens provided")
    }

    // FCM supports up to 500 tokens per multicast
    const maxTokensPerRequest = 500
    
    result := &MulticastResult{
        SuccessCount: 0,
        FailureCount: 0,
        Results:      make([]SendResult, 0),
    }

    // Process in batches
    for i := 0; i < len(tokens); i += maxTokensPerRequest {
        end := i + maxTokensPerRequest
        if end > len(tokens) {
            end = len(tokens)
        }
        
        batch := tokens[i:end]
        batchResult, err := p.sendMulticastBatch(ctx, batch, msg)
        if err != nil {
            return nil, err
        }

        result.SuccessCount += batchResult.SuccessCount
        result.FailureCount += batchResult.FailureCount
        result.Results = append(result.Results, batchResult.Results...)
    }

    return result, nil
}

func (p *FCMProvider) sendMulticastBatch(ctx context.Context, tokens []string, msg *PushMessage) (*MulticastResult, error) {
    fcmMsg := &messaging.MulticastMessage{
        Tokens: tokens,
        Notification: &messaging.Notification{
            Title: msg.Title,
            Body:  msg.Body,
        },
        Data: msg.Data,
    }

    // Add platform-specific configs
    if msg.Android != nil {
        fcmMsg.Android = &messaging.AndroidConfig{
            Priority: msg.Android.Priority,
        }
    }
    if msg.APNS != nil {
        fcmMsg.APNS = &messaging.APNSConfig{
            Headers: map[string]string{
                "apns-priority": msg.APNS.Priority,
            },
        }
    }

    response, err := p.client.SendMulticast(ctx, fcmMsg)
    if err != nil {
        return nil, fmt.Errorf("FCM multicast send failed: %w", err)
    }

    result := &MulticastResult{
        SuccessCount: response.SuccessCount,
        FailureCount: response.FailureCount,
        Results:      make([]SendResult, len(response.Responses)),
    }

    for i, resp := range response.Responses {
        result.Results[i] = SendResult{
            Token:     tokens[i],
            Success:   resp.Success,
            MessageID: resp.MessageID,
        }
        if !resp.Success {
            result.Results[i].Error = resp.Error.Error()
        }
    }

    return result, nil
}

type MulticastResult struct {
    SuccessCount int
    FailureCount int
    Results      []SendResult
}

type SendResult struct {
    Token     string
    Success   bool
    MessageID string
    Error     string
}
```

---

## 7.5 Device Token Management

```go
// internal/store/device_tokens.go
package store

import (
    "context"
    "database/sql"
    "time"
    
    "github.com/google/uuid"
)

type DeviceToken struct {
    ID         uuid.UUID
    UserID     string
    Token      string
    Platform   string // android, ios, web
    Active     bool
    LastUsedAt time.Time
    CreatedAt  time.Time
}

func (s *PostgresStore) UpsertDeviceToken(ctx context.Context, token *DeviceToken) error {
    query := `
        INSERT INTO device_tokens (id, user_id, token, platform, active, last_used_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (token) 
        DO UPDATE SET 
            user_id = EXCLUDED.user_id,
            platform = EXCLUDED.platform,
            active = EXCLUDED.active,
            last_used_at = NOW()
    `
    
    _, err := s.db.ExecContext(ctx, query,
        token.ID, token.UserID, token.Token, token.Platform, token.Active,
    )
    return err
}

func (s *PostgresStore) GetUserDeviceTokens(ctx context.Context, userID string) ([]DeviceToken, error) {
    query := `
        SELECT id, user_id, token, platform, active, last_used_at, created_at
        FROM device_tokens
        WHERE user_id = $1 AND active = true
        ORDER BY last_used_at DESC
    `
    
    rows, err := s.db.QueryContext(ctx, query, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var tokens []DeviceToken
    for rows.Next() {
        var token DeviceToken
        err := rows.Scan(
            &token.ID, &token.UserID, &token.Token, &token.Platform,
            &token.Active, &token.LastUsedAt, &token.CreatedAt,
        )
        if err != nil {
            return nil, err
        }
        tokens = append(tokens, token)
    }

    return tokens, nil
}

func (s *PostgresStore) DeactivateDeviceToken(ctx context.Context, token string) error {
    query := "UPDATE device_tokens SET active = false WHERE token = $1"
    _, err := s.db.ExecContext(ctx, query, token)
    return err
}
```

### Migration for Device Tokens

```sql
-- migrations/007_device_tokens.sql

CREATE TABLE device_tokens (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     VARCHAR(100) NOT NULL,
    token       TEXT UNIQUE NOT NULL,
    platform    VARCHAR(20) NOT NULL,  -- android, ios, web
    active      BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX idx_device_tokens_active ON device_tokens(active) WHERE active = TRUE;
CREATE INDEX idx_device_tokens_token ON device_tokens(token);
```

---

## 7.6 Device Token API Endpoints

```go
// internal/api/devices.go
package api

import (
    "github.com/gofiber/fiber/v2"
    "github.com/google/uuid"
    "buzz-service/internal/store"
)

type DeviceHandler struct {
    store *store.PostgresStore
}

func NewDeviceHandler(store *store.PostgresStore) *DeviceHandler {
    return &DeviceHandler{store: store}
}

// RegisterDevice handles POST /api/v1/devices/register
func (h *DeviceHandler) RegisterDevice(c *fiber.Ctx) error {
    var req struct {
        UserID   string `json:"user_id"`
        Token    string `json:"token"`
        Platform string `json:"platform"`
    }

    if err := c.BodyParser(&req); err != nil {
        return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
    }

    // Validate
    if req.UserID == "" || req.Token == "" || req.Platform == "" {
        return c.Status(400).JSON(fiber.Map{
            "error": "user_id, token, and platform are required",
        })
    }

    // Valid platforms
    validPlatforms := map[string]bool{"android": true, "ios": true, "web": true}
    if !validPlatforms[req.Platform] {
        return c.Status(400).JSON(fiber.Map{
            "error": "invalid platform (must be: android, ios, web)",
        })
    }

    deviceToken := &store.DeviceToken{
        ID:       uuid.New(),
        UserID:   req.UserID,
        Token:    req.Token,
        Platform: req.Platform,
        Active:   true,
    }

    if err := h.store.UpsertDeviceToken(c.Context(), deviceToken); err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "failed to register device",
        })
    }

    return c.Status(201).JSON(fiber.Map{
        "message": "device registered successfully",
        "id":      deviceToken.ID,
    })
}

// ListUserDevices handles GET /api/v1/devices?user_id=xxx
func (h *DeviceHandler) ListUserDevices(c *fiber.Ctx) error {
    userID := c.Query("user_id")
    if userID == "" {
        return c.Status(400).JSON(fiber.Map{
            "error": "user_id query parameter required",
        })
    }

    tokens, err := h.store.GetUserDeviceTokens(c.Context(), userID)
    if err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "failed to fetch devices",
        })
    }

    return c.JSON(fiber.Map{
        "user_id": userID,
        "devices": tokens,
        "count":   len(tokens),
    })
}

// UnregisterDevice handles DELETE /api/v1/devices/:token
func (h *DeviceHandler) UnregisterDevice(c *fiber.Ctx) error {
    token := c.Params("token")
    
    if err := h.store.DeactivateDeviceToken(c.Context(), token); err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "failed to unregister device",
        })
    }

    return c.JSON(fiber.Map{
        "message": "device unregistered successfully",
    })
}
```

---

## 7.7 Push Notification Actions

```go
// internal/provider/push/actions.go
package push

type NotificationAction struct {
    ID    string
    Title string
    Icon  string
}

func AddActionsToWebPush(msg *PushMessage, actions []NotificationAction) {
    if msg.WebPush == nil {
        msg.WebPush = &WebPushConfig{}
    }

    // Actions are added via data payload for web
    if msg.Data == nil {
        msg.Data = make(map[string]string)
    }

    // Serialize actions
    for i, action := range actions {
        prefix := fmt.Sprintf("action_%d", i)
        msg.Data[prefix+"_id"] = action.ID
        msg.Data[prefix+"_title"] = action.Title
        if action.Icon != "" {
            msg.Data[prefix+"_icon"] = action.Icon
        }
    }
}

func AddActionsToAndroid(msg *PushMessage, actions []NotificationAction) {
    // Android uses click_action and data payload
    if msg.Android == nil {
        msg.Android = &AndroidConfig{}
    }
    
    // Actions handled client-side via data
    for i, action := range actions {
        prefix := fmt.Sprintf("action_%d", i)
        msg.Data[prefix+"_id"] = action.ID
        msg.Data[prefix+"_title"] = action.Title
    }
}

func AddActionsToAPNS(msg *PushMessage, category string) {
    // iOS uses categories defined in app
    if msg.APNS == nil {
        msg.APNS = &APNSConfig{}
    }
    msg.APNS.Category = category
}
```

---

## 7.8 Configuration

```bash
# Firebase Cloud Messaging
FCM_CREDENTIALS_FILE=./firebase-adminsdk.json
FCM_PROJECT_ID=your-project-id

# Push Notification Settings
PUSH_BATCH_SIZE=500  # Max tokens per multicast
PUSH_DEFAULT_ICON=https://yourdomain.com/icon.png
PUSH_DEFAULT_BADGE=https://yourdomain.com/badge.png
```

---

## 7.9 Deliverables

✅ FCM provider for Android, iOS, and Web
✅ Topic-based messaging
✅ Multicast/batch push notifications
✅ Device token management system
✅ Device registration API
✅ Platform-specific configurations
✅ Notification actions and deep links
✅ Push notification data payload

---

## 7.10 Testing Phase 7

```bash
# Register a device
curl -X POST http://localhost:8080/api/v1/devices/register \
  -H "Authorization: Bearer buzz_test_key_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "token": "fcm_device_token_here",
    "platform": "android"
  }'

# Send push notification
curl -X POST http://localhost:8080/api/v1/notifications \
  -H "Authorization: Bearer buzz_test_key_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "fcm_device_token_here",
    "channel": "push",
    "subject": "New Assignment",
    "body": "Math 101 homework is now available",
    "data": {
      "action_url": "/assignments/123",
      "screen": "assignment_detail"
    },
    "priority": "high"
  }'

# List user devices
curl "http://localhost:8080/api/v1/devices?user_id=user_123" \
  -H "Authorization: Bearer buzz_test_key_abc123"
```

---

## Next Phase
**Phase 08**: Real-time in-app notifications (SSE/WebSocket gateway)
