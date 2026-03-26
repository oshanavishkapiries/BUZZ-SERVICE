package sms

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/elight/buzz-service/internal/domain"
)

// NotifyLKProvider implements SMSProvider for NotifyLK (Sri Lanka)
type NotifyLKProvider struct {
	apiURL   string
	userID   string
	apiKey   string
	senderID string
	client   *http.Client
}

// NewNotifyLKProvider creates a new NotifyLK SMS provider
func NewNotifyLKProvider(cfg NotifyLKConfig) *NotifyLKProvider {
	return &NotifyLKProvider{
		apiURL:   "https://app.notify.lk/api/v1/send",
		userID:   cfg.UserID,
		apiKey:   cfg.APIKey,
		senderID: cfg.SenderID,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Send delivers a notification via SMS using NotifyLK
func (p *NotifyLKProvider) Send(ctx context.Context, notification *domain.Notification) error {
	msg, err := NotificationToSMSMessage(notification, p.senderID)
	if err != nil {
		return fmt.Errorf("failed to convert notification to SMS: %w", err)
	}

	return p.SendSMS(ctx, msg)
}

// SendSMS sends an SMS via NotifyLK API
func (p *NotifyLKProvider) SendSMS(ctx context.Context, msg *SMSMessage) error {
	// NotifyLK API request format
	payload := map[string]interface{}{
		"user_id":   p.userID,
		"api_key":   p.apiKey,
		"sender_id": msg.From,
		"to":        msg.To,
		"message":   msg.Body,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("NotifyLK API error (status %d): %s", resp.StatusCode, string(body))
	}

	// Parse response
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	// Check for errors in response
	if status, ok := result["status"].(string); ok && status != "success" {
		errorMsg := result["error"]
		return fmt.Errorf("NotifyLK error: %v", errorMsg)
	}

	// Success - result["data"] contains message_id for tracking
	return nil
}

// Name returns the provider name
func (p *NotifyLKProvider) Name() string {
	return "notifylk"
}

// SupportsChannel checks if the provider supports a given channel
func (p *NotifyLKProvider) SupportsChannel(channel domain.Channel) bool {
	return channel == domain.ChannelSMS
}

// SupportsCountry checks if the provider supports a given country code
func (p *NotifyLKProvider) SupportsCountry(countryCode string) bool {
	// Sri Lanka country code
	return countryCode == "94"
}
