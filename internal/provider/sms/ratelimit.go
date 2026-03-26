package sms

import (
	"context"

	"golang.org/x/time/rate"
	"github.com/elight/buzz-service/internal/domain"
)

// RateLimitedSMSProvider wraps an SMSProvider with rate limiting
type RateLimitedSMSProvider struct {
	provider SMSProvider
	limiter  *rate.Limiter
}

// NewRateLimitedSMSProvider creates a rate-limited SMS provider
// messagesPerSecond: maximum SMS per second
func NewRateLimitedSMSProvider(provider SMSProvider, messagesPerSecond int) *RateLimitedSMSProvider {
	return &RateLimitedSMSProvider{
		provider: provider,
		limiter:  rate.NewLimiter(rate.Limit(messagesPerSecond), messagesPerSecond),
	}
}

// SendSMS sends an SMS with rate limiting
func (p *RateLimitedSMSProvider) SendSMS(ctx context.Context, msg *SMSMessage) error {
	// Wait for rate limiter token
	if err := p.limiter.Wait(ctx); err != nil {
		return err
	}

	return p.provider.SendSMS(ctx, msg)
}

// Send delivers a notification with rate limiting
func (p *RateLimitedSMSProvider) Send(ctx context.Context, notification *domain.Notification) error {
	// Wait for rate limiter token
	if err := p.limiter.Wait(ctx); err != nil {
		return err
	}

	return p.provider.Send(ctx, notification)
}

// Name returns the provider name with rate limit indicator
func (p *RateLimitedSMSProvider) Name() string {
	return p.provider.Name()
}

// SupportsChannel checks if the provider supports a given channel
func (p *RateLimitedSMSProvider) SupportsChannel(channel domain.Channel) bool {
	return p.provider.SupportsChannel(channel)
}

// SupportsCountry checks if the provider supports a given country
func (p *RateLimitedSMSProvider) SupportsCountry(countryCode string) bool {
	return p.provider.SupportsCountry(countryCode)
}
