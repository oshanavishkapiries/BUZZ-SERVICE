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

// TextLKProvider implements SMSProvider for Text.lk (Sri Lanka)
type TextLKProvider struct {
	apiURL   string
	apiToken string
	senderID string
	client   *http.Client
}

// NewTextLKProvider creates a new Text.lk SMS provider
func NewTextLKProvider(cfg TextLKConfig) *TextLKProvider {
	return &TextLKProvider{
		apiURL:   "https://app.text.lk/api/http/sms/send",
		apiToken: cfg.APIToken,
		senderID: cfg.SenderID,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Send delivers a notification via SMS using Text.lk
func (p *TextLKProvider) Send(ctx context.Context, notification *domain.Notification) error {
	msg, err := NotificationToSMSMessage(notification, p.senderID)
	if err != nil {
		return fmt.Errorf("failed to convert notification to SMS: %w", err)
	}

	return p.SendSMS(ctx, msg)
}

// SendSMS sends an SMS via Text.lk API
func (p *TextLKProvider) SendSMS(ctx context.Context, msg *SMSMessage) error {
	msgType := "plain"
	if msg.IsUnicode {
		msgType = "unicode"
	}

	payload := map[string]interface{}{
		"api_token": p.apiToken,
		"recipient": msg.To,
		"sender_id": msg.From,
		"type":      msgType,
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
	req.Header.Set("Accept", "application/json")

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
		return fmt.Errorf("Text.lk API error (status %d): %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if status, ok := result["status"].(string); ok && status != "success" {
		return fmt.Errorf("Text.lk error: %v", result["message"])
	}

	return nil
}

// Name returns the provider name
func (p *TextLKProvider) Name() string {
	return "textlk"
}

// SupportsChannel checks if the provider supports a given channel
func (p *TextLKProvider) SupportsChannel(channel domain.Channel) bool {
	return channel == domain.ChannelSMS
}

// SupportsCountry checks if the provider supports a given country code
func (p *TextLKProvider) SupportsCountry(countryCode string) bool {
	return countryCode == "94"
}
