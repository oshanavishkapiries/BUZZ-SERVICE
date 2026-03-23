package api

import (
	"fmt"
	"regexp"
	"time"

	"github.com/elight/buzz-service/internal/domain"
)

var (
	// RFC 5322 compliant email regex (simplified)
	emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	
	// E.164 phone number format: +[country code][number]
	// Accepts: +1234567890 to +123456789012345
	phoneRegex = regexp.MustCompile(`^\+[1-9]\d{1,14}$`)
)

// SendNotificationRequest represents the request body for sending a notification
type SendNotificationRequest struct {
	To             string                 `json:"to"`
	Channel        domain.Channel         `json:"channel"`
	Priority       domain.Priority        `json:"priority,omitempty"`
	Template       string                 `json:"template,omitempty"`
	Subject        string                 `json:"subject,omitempty"`
	Body           string                 `json:"body,omitempty"`
	Data           map[string]interface{} `json:"data,omitempty"`
	RecipientID    string                 `json:"recipient_id,omitempty"`
	RecipientName  string                 `json:"recipient_name,omitempty"`
	IdempotencyKey string                 `json:"idempotency_key,omitempty"`
	ScheduledFor   *time.Time             `json:"scheduled_for,omitempty"`
}

// Validate validates the send notification request
func (r *SendNotificationRequest) Validate() error {
	// Required fields
	if r.To == "" {
		return fmt.Errorf("'to' field is required")
	}

	if r.Channel == "" {
		return fmt.Errorf("'channel' field is required")
	}

	// Validate channel
	if !isValidChannel(r.Channel) {
		return fmt.Errorf("invalid channel: %s (must be one of: email, sms, push, in_app)", r.Channel)
	}

	// Validate 'to' address format based on channel
	if err := validateToAddress(r.To, r.Channel); err != nil {
		return err
	}

	// Either template or body must be provided
	if r.Template == "" && r.Body == "" {
		return fmt.Errorf("either 'template' or 'body' must be provided")
	}

	// Email requires subject (unless using template)
	if r.Channel == domain.ChannelEmail && r.Subject == "" && r.Template == "" {
		return fmt.Errorf("'subject' is required for email notifications when not using a template")
	}

	// Validate priority (set default if not provided)
	if r.Priority == "" {
		r.Priority = domain.PriorityNormal
	}
	if !isValidPriority(r.Priority) {
		return fmt.Errorf("invalid priority: %s (must be one of: low, normal, high, urgent)", r.Priority)
	}

	// Validate scheduled time (must be in the future)
	if r.ScheduledFor != nil && r.ScheduledFor.Before(time.Now()) {
		return fmt.Errorf("'scheduled_for' must be in the future")
	}

	return nil
}

// isValidChannel checks if the channel is valid
func isValidChannel(channel domain.Channel) bool {
	validChannels := map[domain.Channel]bool{
		domain.ChannelEmail:  true,
		domain.ChannelSMS:    true,
		domain.ChannelPush:   true,
		domain.ChannelInApp:  true,
	}
	return validChannels[channel]
}

// isValidPriority checks if the priority is valid
func isValidPriority(priority domain.Priority) bool {
	validPriorities := map[domain.Priority]bool{
		domain.PriorityLow:    true,
		domain.PriorityNormal: true,
		domain.PriorityHigh:   true,
		domain.PriorityUrgent: true,
	}
	return validPriorities[priority]
}

// validateToAddress validates the 'to' address based on the channel
func validateToAddress(to string, channel domain.Channel) error {
	switch channel {
	case domain.ChannelEmail:
		if !emailRegex.MatchString(to) {
			return fmt.Errorf("invalid email address format")
		}
	case domain.ChannelSMS:
		if !phoneRegex.MatchString(to) {
			return fmt.Errorf("invalid phone number format (must be E.164 format, e.g., +1234567890)")
		}
	case domain.ChannelPush:
		// Push tokens are typically long strings, just check not empty
		if len(to) < 10 {
			return fmt.Errorf("invalid device token (too short)")
		}
	case domain.ChannelInApp:
		// In-app requires user ID, just check not empty
		if len(to) == 0 {
			return fmt.Errorf("user ID is required for in-app notifications")
		}
	}
	return nil
}

// CreateTemplateRequest represents the request body for creating a template
type CreateTemplateRequest struct {
	Name     string                 `json:"name"`
	Channel  domain.Channel         `json:"channel"`
	Subject  string                 `json:"subject,omitempty"`
	Body     string                 `json:"body"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// Validate validates the create template request
func (r *CreateTemplateRequest) Validate() error {
	if r.Name == "" {
		return fmt.Errorf("'name' field is required")
	}

	if r.Body == "" {
		return fmt.Errorf("'body' field is required")
	}

	if r.Channel != "" && !isValidChannel(r.Channel) {
		return fmt.Errorf("invalid channel: %s", r.Channel)
	}

	// Email templates should have a subject
	if r.Channel == domain.ChannelEmail && r.Subject == "" {
		return fmt.Errorf("'subject' is required for email templates")
	}

	return nil
}

// UpdateTemplateRequest represents the request body for updating a template
type UpdateTemplateRequest struct {
	Subject  *string                 `json:"subject,omitempty"`
	Body     *string                 `json:"body,omitempty"`
	Metadata map[string]interface{}  `json:"metadata,omitempty"`
	Active   *bool                   `json:"active,omitempty"`
}
