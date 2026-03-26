package sms

import (
	"context"
	"fmt"

	"github.com/elight/buzz-service/internal/domain"
)

// SMSRouter implements SMSProvider with intelligent multi-provider routing
// Routes SMS to the best provider based on destination country
type SMSRouter struct {
	providers []SMSProvider
	fallback  SMSProvider
}

// NewSMSRouter creates a new SMS router
// providers: list of providers to try in order
// fallback: provider to use if none of the primary providers support the country
func NewSMSRouter(providers []SMSProvider, fallback SMSProvider) *SMSRouter {
	return &SMSRouter{
		providers: providers,
		fallback:  fallback,
	}
}

// Send routes the notification to the appropriate SMS provider based on country code
func (r *SMSRouter) Send(ctx context.Context, notification *domain.Notification) error {
	// Extract country code from phone number
	toPhone := ""
	if notification.Recipient != nil {
		if addr, ok := notification.Recipient["address"].(string); ok {
			toPhone = addr
		}
	}

	if toPhone == "" {
		return fmt.Errorf("notification missing recipient phone address")
	}

	countryCode := CountryCode(toPhone)

	// Find suitable provider based on country
	for _, provider := range r.providers {
		if provider.SupportsCountry(countryCode) {
			err := provider.Send(ctx, notification)
			if err == nil {
				return nil
			}
			// Log error and try next provider
			fmt.Printf("Provider %s failed: %v\n", provider.Name(), err)
		}
	}

	// Use fallback provider if primary providers failed or didn't support country
	if r.fallback != nil {
		return r.fallback.Send(ctx, notification)
	}

	return fmt.Errorf("no suitable SMS provider found for country code: %s", countryCode)
}

// SendSMS routes an SMS message to the appropriate provider
func (r *SMSRouter) SendSMS(ctx context.Context, msg *SMSMessage) error {
	countryCode := CountryCode(msg.To)

	// Find suitable provider based on country
	for _, provider := range r.providers {
		if provider.SupportsCountry(countryCode) {
			err := provider.SendSMS(ctx, msg)
			if err == nil {
				return nil
			}
			// Log error and try next provider
			fmt.Printf("Provider %s failed: %v\n", provider.Name(), err)
		}
	}

	// Use fallback provider
	if r.fallback != nil {
		return r.fallback.SendSMS(ctx, msg)
	}

	return fmt.Errorf("no suitable SMS provider found for country code: %s", countryCode)
}

// Name returns the router name
func (r *SMSRouter) Name() string {
	return "sms-router"
}

// SupportsChannel checks if router supports SMS channel
func (r *SMSRouter) SupportsChannel(channel domain.Channel) bool {
	return channel == domain.ChannelSMS
}

// SupportsCountry checks if any provider supports the country
func (r *SMSRouter) SupportsCountry(countryCode string) bool {
	for _, provider := range r.providers {
		if provider.SupportsCountry(countryCode) {
			return true
		}
	}
	if r.fallback != nil {
		return r.fallback.SupportsCountry(countryCode)
	}
	return false
}
