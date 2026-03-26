package provider

import (
	"context"

	"github.com/elight/buzz-service/internal/domain"
)

// Provider defines the interface for notification delivery providers
type Provider interface {
	// Send delivers a notification
	Send(ctx context.Context, notification *domain.Notification) error

	// Name returns the provider name
	Name() string

	// SupportsChannel checks if the provider supports a given channel
	SupportsChannel(channel domain.Channel) bool
}

// RateLimitedProvider extends Provider with rate limiting
type RateLimitedProvider interface {
	Provider

	// RateLimit returns the max requests per second
	RateLimit() int
}
