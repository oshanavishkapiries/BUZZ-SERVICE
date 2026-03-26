package inapp

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/elight/buzz-service/internal/domain"
	"github.com/elight/buzz-service/internal/store"
)

// InAppProvider delivers in-app notifications by storing to database and publishing to Redis
type InAppProvider struct {
	store       *store.PostgresStore
	redisClient *redis.Client
}

// NewInAppProvider creates a new in-app provider
func NewInAppProvider(st *store.PostgresStore, redisClient *redis.Client) *InAppProvider {
	return &InAppProvider{
		store:       st,
		redisClient: redisClient,
	}
}

// Send delivers an in-app notification
func (p *InAppProvider) Send(ctx context.Context, n *domain.Notification) error {
	// Extract user ID from recipient
	userID := ""
	if n.Recipient != nil {
		if id, ok := n.Recipient["user_id"].(string); ok {
			userID = id
		}
	}

	if userID == "" {
		return fmt.Errorf("notification missing recipient user_id")
	}

	// 1. Create inbox entry
	inboxEntry := &domain.InboxEntry{
		ID:             uuid.New(),
		NotificationID: &n.ID,
		UserID:         userID,
		Title:          derefString(n.Subject),
		Body:           n.Body,
		Metadata:       n.Variables,
		IsRead:         false,
		IsArchived:     false,
	}

	if err := p.store.CreateInboxEntry(ctx, inboxEntry); err != nil {
		return fmt.Errorf("failed to create inbox entry: %w", err)
	}

	// 2. Publish to Redis Pub/Sub for real-time delivery
	channel := fmt.Sprintf("user:%s", userID)
	payload := map[string]interface{}{
		"id":         inboxEntry.ID,
		"title":      inboxEntry.Title,
		"body":       inboxEntry.Body,
		"metadata":   inboxEntry.Metadata,
		"read":       false,
		"created_at": inboxEntry.CreatedAt,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	if err := p.redisClient.Publish(ctx, channel, jsonPayload).Err(); err != nil {
		return fmt.Errorf("failed to publish to Redis: %w", err)
	}

	return nil
}

// derefString safely dereferences a string pointer
func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// Name returns the provider name
func (p *InAppProvider) Name() string {
	return "in-app"
}

// SupportsChannel checks if provider supports in-app channel
func (p *InAppProvider) SupportsChannel(channel domain.Channel) bool {
	return channel == domain.ChannelInApp
}
