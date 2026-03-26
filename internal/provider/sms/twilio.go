package sms

import (
	"context"
	"fmt"

	"github.com/twilio/twilio-go"
	twilioApi "github.com/twilio/twilio-go/rest/api/v2010"
	"github.com/elight/buzz-service/internal/domain"
)

// TwilioProvider implements SMSProvider for Twilio (International)
type TwilioProvider struct {
	client              *twilio.RestClient
	fromNumber          string
	messagingServiceSID string
}

// NewTwilioProvider creates a new Twilio SMS provider
func NewTwilioProvider(cfg TwilioConfig) *TwilioProvider {
	client := twilio.NewRestClientWithParams(twilio.ClientParams{
		Username: cfg.AccountSID,
		Password: cfg.AuthToken,
	})

	return &TwilioProvider{
		client:              client,
		fromNumber:          cfg.FromNumber,
		messagingServiceSID: cfg.MessagingServiceSID,
	}
}

// Send delivers a notification via SMS using Twilio
func (p *TwilioProvider) Send(ctx context.Context, notification *domain.Notification) error {
	msg, err := NotificationToSMSMessage(notification, p.fromNumber)
	if err != nil {
		return fmt.Errorf("failed to convert notification to SMS: %w", err)
	}

	return p.SendSMS(ctx, msg)
}

// SendSMS sends an SMS via Twilio API
func (p *TwilioProvider) SendSMS(ctx context.Context, msg *SMSMessage) error {
	params := &twilioApi.CreateMessageParams{}
	params.SetTo(msg.To)
	params.SetBody(msg.Body)

	// Use messaging service SID if configured (recommended for better deliverability)
	if p.messagingServiceSID != "" {
		params.SetMessagingServiceSid(p.messagingServiceSID)
	} else {
		params.SetFrom(p.fromNumber)
	}

	// Send SMS
	resp, err := p.client.Api.CreateMessage(params)
	if err != nil {
		return fmt.Errorf("Twilio send failed: %w", err)
	}

	// Check status
	if resp.Status == nil {
		return fmt.Errorf("Twilio error: no status in response")
	}

	// Valid statuses: queued, sending, sent, delivered, undelivered, failed
	status := *resp.Status
	if status != "queued" && status != "sending" && status != "sent" && status != "delivered" {
		errorMsg := "unknown error"
		if resp.ErrorMessage != nil {
			errorMsg = *resp.ErrorMessage
		}
		return fmt.Errorf("Twilio error (status %s): %s", status, errorMsg)
	}

	// Success - resp.Sid contains message SID for tracking
	_ = resp.Sid

	return nil
}

// Name returns the provider name
func (p *TwilioProvider) Name() string {
	return "twilio"
}

// SupportsChannel checks if the provider supports a given channel
func (p *TwilioProvider) SupportsChannel(channel domain.Channel) bool {
	return channel == domain.ChannelSMS
}

// SupportsCountry checks if the provider supports a given country code
// Twilio supports most countries globally
func (p *TwilioProvider) SupportsCountry(countryCode string) bool {
	return true
}
