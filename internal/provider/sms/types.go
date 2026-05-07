package sms

import (
	"context"
	"fmt"

	"github.com/elight/buzz-service/internal/domain"
)

// SMSMessage represents an SMS to be sent
type SMSMessage struct {
	To        string            // E.164 format: +94771234567
	From      string            // Sender ID (alphanumeric or shortcode)
	Body      string            // Message content
	IsUnicode bool              // Unicode encoding for Sinhala/Tamil
	Metadata  map[string]string // Provider-specific data
}

// SMSProvider defines the interface for SMS delivery
type SMSProvider interface {
	SendSMS(ctx context.Context, msg *SMSMessage) error
	Name() string
	SupportsChannel(channel domain.Channel) bool
	SupportsCountry(countryCode string) bool
	Send(ctx context.Context, notification *domain.Notification) error
}

// SMSConfig contains SMS provider configuration
type SMSConfig struct {
	Provider              string
	RateLimitPerSecond    int
	MaxSegments           int
	DefaultSenderID       string
}

// TextLKConfig contains Text.lk-specific configuration
type TextLKConfig struct {
	APIToken string
	SenderID string
}

// TwilioConfig contains Twilio-specific configuration
type TwilioConfig struct {
	AccountSID          string
	AuthToken           string
	FromNumber          string
	MessagingServiceSID string
}

// NotificationToSMSMessage converts a domain.Notification to an SMSMessage
// It extracts the recipient phone from the Recipient JSONB field
func NotificationToSMSMessage(n *domain.Notification, senderID string) (*SMSMessage, error) {
	// Extract recipient phone from JSONB map
	toPhone := ""
	if n.Recipient != nil {
		if addr, ok := n.Recipient["address"].(string); ok {
			toPhone = addr
		}
	}

	if toPhone == "" {
		return nil, fmt.Errorf("notification missing recipient phone address")
	}

	return &SMSMessage{
		To:        toPhone,
		From:      senderID,
		Body:      n.Body,
		IsUnicode: isUnicodeRequired(n.Body),
		Metadata: map[string]string{
			"notification_id": n.ID.String(),
		},
	}, nil
}

// isUnicodeRequired checks if text contains non-ASCII characters (Sinhala/Tamil/etc.)
func isUnicodeRequired(text string) bool {
	for _, r := range text {
		if r > 127 {
			return true
		}
	}
	return false
}

// CountryCode extracts country code from E.164 phone number
// E.164 format: +[1-9]{1-3}[0-9]{0,14}
// Returns: "94" from "+94771234567"
func CountryCode(phoneNumber string) string {
	if len(phoneNumber) < 3 {
		return ""
	}

	if phoneNumber[0] == '+' {
		// +94... -> extract country code (2-3 digits)
		// Try 3-digit country code first (for countries like +886, +886, etc.)
		if len(phoneNumber) >= 4 && phoneNumber[1] != '0' {
			// Check if it's a valid 3-digit code
			if phoneNumber[2] >= '0' && phoneNumber[2] <= '9' && phoneNumber[3] >= '0' && phoneNumber[3] <= '9' {
				// Could be 2-digit or 3-digit, use heuristic
				// Most common 2-digit codes: 1 (US), 44 (UK), 91 (India), 86 (China), 81 (Japan)
				// For +94 (Sri Lanka), it's a 2-digit code
				if len(phoneNumber) >= 3 && phoneNumber[1:3] == "94" {
					return "94"
				}
			}
		}
		// Extract first 2 digits as country code
		if len(phoneNumber) >= 3 {
			return phoneNumber[1:3]
		}
	}
	return phoneNumber[:2]
}

// ValidatePhoneNumber validates E.164 format phone number
func ValidatePhoneNumber(phone string) error {
	if len(phone) == 0 {
		return fmt.Errorf("phone number cannot be empty")
	}

	if phone[0] != '+' {
		return fmt.Errorf("phone number must start with '+' (E.164 format)")
	}

	if len(phone) < 10 || len(phone) > 16 {
		return fmt.Errorf("phone number length out of range (10-16 characters including +)")
	}

	// Check that all characters after + are digits
	for i := 1; i < len(phone); i++ {
		if phone[i] < '0' || phone[i] > '9' {
			return fmt.Errorf("phone number contains invalid characters")
		}
	}

	return nil
}
