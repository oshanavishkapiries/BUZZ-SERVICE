package email

import (
	"context"

	"golang.org/x/time/rate"
	"github.com/elight/buzz-service/internal/domain"
)

// RateLimitedEmailProvider wraps an EmailProvider with rate limiting
type RateLimitedEmailProvider struct {
	provider EmailProvider
	limiter  *rate.Limiter
}

// NewRateLimitedProvider creates a rate-limited email provider
// rps is the number of requests (emails) per second
func NewRateLimitedProvider(provider EmailProvider, rps int) *RateLimitedEmailProvider {
	return &RateLimitedEmailProvider{
		provider: provider,
		limiter:  rate.NewLimiter(rate.Limit(rps), rps*2), // burst = 2x rate
	}
}

// SendEmail sends an email with rate limiting
func (p *RateLimitedEmailProvider) SendEmail(ctx context.Context, msg *EmailMessage) error {
	// Wait for rate limiter token
	if err := p.limiter.Wait(ctx); err != nil {
		return err
	}

	return p.provider.SendEmail(ctx, msg)
}

// Name returns the provider name
func (p *RateLimitedEmailProvider) Name() string {
	return p.provider.Name()
}

// SupportsChannel checks if the provider supports a given channel
func (p *RateLimitedEmailProvider) SupportsChannel(channel domain.Channel) bool {
	return p.provider.SupportsChannel(channel)
}

// Send delivers a notification with rate limiting
func (p *RateLimitedEmailProvider) Send(ctx context.Context, notification *domain.Notification) error {
	msg, err := NotificationToEmailMessage(notification, EmailConfig{})
	if err != nil {
		return err
	}
	return p.SendEmail(ctx, msg)
}
