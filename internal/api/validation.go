package api

import (
	"fmt"
	"regexp"
	"time"

	"github.com/elight/buzz-service/internal/domain"
)

// CreateProviderRequest represents the request body for creating a provider config
type CreateProviderRequest struct {
	Name      string                 `json:"name"`
	Channel   domain.Channel         `json:"channel"`
	Provider  string                 `json:"provider"`
	Config    map[string]interface{} `json:"config"`
	IsDefault bool                   `json:"is_default,omitempty"`
}

// Validate validates the create provider request
func (r *CreateProviderRequest) Validate() error {
	if r.Name == "" {
		return fmt.Errorf("'name' is required")
	}
	if !isValidChannel(r.Channel) {
		return fmt.Errorf("invalid channel: %s (must be one of: email, sms, push, in_app)", r.Channel)
	}
	if r.Provider == "" {
		return fmt.Errorf("'provider' is required (e.g. ses, smtp, twilio, notifylk, fcm)")
	}
	return nil
}

// UpdateProviderRequest represents the request body for updating a provider config
type UpdateProviderRequest struct {
	Name      *string                `json:"name,omitempty"`
	Config    map[string]interface{} `json:"config,omitempty"`
	IsDefault *bool                  `json:"is_default,omitempty"`
	IsActive  *bool                  `json:"is_active,omitempty"`
}

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
	Provider       string                 `json:"provider,omitempty"`
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
	Name      string                 `json:"name"`
	Channels  []string               `json:"channels,omitempty"`  // preferred: multi-channel
	Channel   domain.Channel         `json:"channel,omitempty"`   // legacy: single channel
	Subject   string                 `json:"subject,omitempty"`
	Body      string                 `json:"body"`
	Variables []string               `json:"variables,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// ResolvedChannels returns the effective channels list, merging Channel + Channels fields.
func (r *CreateTemplateRequest) ResolvedChannels() []string {
	seen := map[string]bool{}
	var result []string
	for _, ch := range r.Channels {
		if !seen[ch] {
			seen[ch] = true
			result = append(result, ch)
		}
	}
	if r.Channel != "" && !seen[string(r.Channel)] {
		result = append(result, string(r.Channel))
	}
	return result
}

// Validate validates the create template request
func (r *CreateTemplateRequest) Validate() error {
	if r.Name == "" {
		return fmt.Errorf("'name' field is required")
	}
	if r.Body == "" {
		return fmt.Errorf("'body' field is required")
	}

	channels := r.ResolvedChannels()
	for _, ch := range channels {
		if !isValidChannel(domain.Channel(ch)) {
			return fmt.Errorf("invalid channel: %s (must be one of: email, sms, push, in_app)", ch)
		}
	}

	// Email templates need a subject
	for _, ch := range channels {
		if ch == string(domain.ChannelEmail) && r.Subject == "" {
			return fmt.Errorf("'subject' is required for email templates")
		}
	}

	return nil
}

// UpdateTemplateRequest represents the request body for updating a template
type UpdateTemplateRequest struct {
	Channels []string               `json:"channels,omitempty"`
	Subject  *string                `json:"subject,omitempty"`
	Body     *string                `json:"body,omitempty"`
	Variables []string              `json:"variables,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
	Active   *bool                  `json:"active,omitempty"`
}

// RegisterDeviceRequest represents the request body for registering a device
type RegisterDeviceRequest struct {
	UserID   string `json:"user_id"  example:"user-123"`
	Token    string `json:"token"    example:"fcm-token-abc123"`
	Platform string `json:"platform" example:"android" enums:"android,ios,web"`
}

// SendBulkRequest represents the request body for sending a bulk notification
type SendBulkRequest struct {
	DatasourceName string                 `json:"datasource_name"  example:"crm"`
	EndpointName   string                 `json:"endpoint_name"    example:"active_users"`
	EndpointParams map[string]interface{} `json:"endpoint_params,omitempty"`
	TemplateName   string                 `json:"template_name"    example:"welcome_email"`
	TemplateData   map[string]interface{} `json:"template_data,omitempty"`
	Channel        domain.Channel         `json:"channel"          example:"email"`
	Priority       domain.Priority        `json:"priority,omitempty" example:"normal"`
	IdempotencyKey string                 `json:"idempotency_key,omitempty"`
}

// CreateDatasourceRequest represents the request body for registering a datasource
type CreateDatasourceRequest struct {
	Name       string                 `json:"name"`
	BaseURL    string                 `json:"base_url"`
	AuthType   string                 `json:"auth_type,omitempty"` // bearer, basic, api_key, ""
	AuthConfig map[string]interface{} `json:"auth_config,omitempty"`
	Endpoints  map[string]interface{} `json:"endpoints,omitempty"`
}

// UpdateDatasourceRequest represents the request body for updating a datasource
type UpdateDatasourceRequest struct {
	BaseURL    *string                `json:"base_url,omitempty"`
	AuthType   *string                `json:"auth_type,omitempty"`
	AuthConfig map[string]interface{} `json:"auth_config,omitempty"`
	Endpoints  map[string]interface{} `json:"endpoints,omitempty"`
}

// ErrorResponse is the standard error response body
type ErrorResponse struct {
	Error   string `json:"error"             example:"validation failed"`
	Details string `json:"details,omitempty" example:"'to' field is required"`
}

// MessageResponse is a generic success message response
type MessageResponse struct {
	Message string `json:"message" example:"operation completed successfully"`
}
