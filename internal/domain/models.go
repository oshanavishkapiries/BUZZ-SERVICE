package domain

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Channel represents a notification delivery channel
type Channel string

const (
	ChannelEmail Channel = "email"
	ChannelSMS   Channel = "sms"
	ChannelPush  Channel = "push"
	ChannelInApp Channel = "in_app"
)

// Priority represents notification priority level
type Priority string

const (
	PriorityLow    Priority = "low"
	PriorityNormal Priority = "normal"
	PriorityHigh   Priority = "high"
	PriorityUrgent Priority = "urgent"
)

// NotificationStatus represents the lifecycle status of a notification
type NotificationStatus string

const (
	StatusPending    NotificationStatus = "pending"
	StatusQueued     NotificationStatus = "queued"
	StatusProcessing NotificationStatus = "processing"
	StatusSent       NotificationStatus = "sent"
	StatusDelivered  NotificationStatus = "delivered"
	StatusFailed     NotificationStatus = "failed"
	StatusCancelled  NotificationStatus = "cancelled"
)

// BatchStatus represents the status of a batch operation
type BatchStatus string

const (
	BatchStatusPending    BatchStatus = "pending"
	BatchStatusProcessing BatchStatus = "processing"
	BatchStatusCompleted  BatchStatus = "completed"
	BatchStatusFailed     BatchStatus = "failed"
	BatchStatusCancelled  BatchStatus = "cancelled"
	// Phase 9 specific statuses
	BatchStatusFetching   BatchStatus = "fetching"
	BatchStatusQueued     BatchStatus = "queued"
	BatchStatusDelivering BatchStatus = "delivering"
)

// DatasourceType represents the type of external data source
type DatasourceType string

const (
	DatasourceGoogleSheets DatasourceType = "google_sheets"
	DatasourceCSV          DatasourceType = "csv"
	DatasourceJSON         DatasourceType = "json"
	DatasourceAPI          DatasourceType = "api"
)

// Environment represents the API key environment
type Environment string

const (
	EnvProduction  Environment = "production"
	EnvStaging     Environment = "staging"
	EnvDevelopment Environment = "development"
	EnvTest        Environment = "test"
)

// Platform represents device platform for push notifications
type Platform string

const (
	PlatformIOS     Platform = "ios"
	PlatformAndroid Platform = "android"
	PlatformWeb     Platform = "web"
)

// JSONB is a custom type for PostgreSQL JSONB columns
type JSONB map[string]interface{}

// Value implements driver.Valuer interface
func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements sql.Scanner interface
func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("failed to unmarshal JSONB value: %v", value)
	}
	return json.Unmarshal(bytes, j)
}

// User represents a dashboard account
type User struct {
	ID           uuid.UUID `json:"id" db:"id"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"`
	Name         string    `json:"name" db:"name"`
	Role         string    `json:"role" db:"role"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// Application represents a tenant workspace
type Application struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description *string   `json:"description,omitempty" db:"description"`
	OwnerID     uuid.UUID `json:"owner_id" db:"owner_id"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// ApplicationMember maps users to applications with roles
type ApplicationMember struct {
	ApplicationID uuid.UUID `json:"application_id" db:"application_id"`
	UserID        uuid.UUID `json:"user_id" db:"user_id"`
	Role          string    `json:"role" db:"role"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

// ApplicationMemberDetail represents a member with user profile details
type ApplicationMemberDetail struct {
	ApplicationID uuid.UUID `json:"application_id"`
	UserID        uuid.UUID `json:"user_id"`
	Role          string    `json:"role"`
	Name          string    `json:"name"`
	Email         string    `json:"email"`
	CreatedAt     time.Time `json:"created_at"`
}

// Notification represents an individual notification
type Notification struct {
	ID                uuid.UUID          `json:"id" db:"id"`
	ApplicationID     uuid.UUID          `json:"application_id" db:"application_id"`
	BatchID           *uuid.UUID         `json:"batch_id,omitempty" db:"batch_id"`
	Channel           Channel            `json:"channel" db:"channel"`
	Priority          Priority           `json:"priority" db:"priority"`
	Recipient         JSONB              `json:"recipient" db:"recipient"`
	Subject           *string            `json:"subject,omitempty" db:"subject"`
	Body              string             `json:"body" db:"body"`
	HTMLBody          *string            `json:"html_body,omitempty" db:"html_body"`
	TemplateID        *uuid.UUID         `json:"template_id,omitempty" db:"template_id"`
	Variables         JSONB              `json:"variables,omitempty" db:"variables"`
	Status            NotificationStatus `json:"status" db:"status"`
	Provider          *string            `json:"provider,omitempty" db:"provider"`
	ProviderMessageID *string            `json:"provider_message_id,omitempty" db:"provider_message_id"`
	ProviderResponse  JSONB              `json:"provider_response,omitempty" db:"provider_response"`
	QueuedAt          *time.Time         `json:"queued_at,omitempty" db:"queued_at"`
	SentAt            *time.Time         `json:"sent_at,omitempty" db:"sent_at"`
	DeliveredAt       *time.Time         `json:"delivered_at,omitempty" db:"delivered_at"`
	FailedAt          *time.Time         `json:"failed_at,omitempty" db:"failed_at"`
	RetryCount        int                `json:"retry_count" db:"retry_count"`
	MaxRetries        int                `json:"max_retries" db:"max_retries"`
	NextRetryAt       *time.Time         `json:"next_retry_at,omitempty" db:"next_retry_at"`
	ErrorMessage      *string            `json:"error_message,omitempty" db:"error_message"`
	ErrorCode         *string            `json:"error_code,omitempty" db:"error_code"`
	Metadata          JSONB              `json:"metadata,omitempty" db:"metadata"`
	CreatedAt         time.Time          `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time          `json:"updated_at" db:"updated_at"`
	CreatedBy         *uuid.UUID         `json:"created_by,omitempty" db:"created_by"`
	DeletedAt         *time.Time         `json:"deleted_at,omitempty" db:"deleted_at"`
}

// Batch represents a bulk notification operation
type Batch struct {
	ID             uuid.UUID   `json:"id" db:"id"`
	ApplicationID  uuid.UUID   `json:"application_id" db:"application_id"`
	DatasourceID   *uuid.UUID  `json:"datasource_id,omitempty" db:"datasource_id"`
	DatasourceName string      `json:"datasource_name" db:"datasource_name"`
	EndpointName   string      `json:"endpoint_name" db:"endpoint_name"`
	EndpointParams JSONB       `json:"endpoint_params,omitempty" db:"endpoint_params"`
	TemplateName   string      `json:"template_name" db:"template_name"`
	Channel        Channel     `json:"channel" db:"channel"`
	Priority       Priority    `json:"priority" db:"priority"`
	TemplateData   JSONB       `json:"template_data,omitempty" db:"template_data"`
	Status         BatchStatus `json:"status" db:"status"`
	Total          int         `json:"total_count" db:"total"`
	Sent           int         `json:"sent_count" db:"sent"`
	Failed         int         `json:"failed_count" db:"failed"`
	Skipped        int         `json:"skipped_count" db:"skipped"`
	IdempotencyKey string      `json:"idempotency_key,omitempty" db:"idempotency_key"`
	ErrorMessage   *string     `json:"error_message,omitempty" db:"error_message"`
	StartedAt      *time.Time  `json:"started_at,omitempty" db:"started_at"`
	CompletedAt    *time.Time  `json:"completed_at,omitempty" db:"completed_at"`
	CreatedAt      time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at" db:"updated_at"`
}

// Template represents a reusable notification template
type Template struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	ApplicationID uuid.UUID  `json:"application_id" db:"application_id"`
	Name          string     `json:"name" db:"name"`
	Description   *string    `json:"description,omitempty" db:"description"`
	Channels      []string   `json:"channels" db:"channels"`
	Subject       *string    `json:"subject,omitempty" db:"subject"`
	Body          string     `json:"body" db:"body"`
	HTMLBody      *string    `json:"html_body,omitempty" db:"html_body"`
	Variables     []string   `json:"variables" db:"variables"`
	DefaultValues JSONB      `json:"default_values,omitempty" db:"default_values"`
	Config        JSONB      `json:"config,omitempty" db:"config"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
	CreatedBy     *uuid.UUID `json:"created_by,omitempty" db:"created_by"`
	IsActive      bool       `json:"is_active" db:"is_active"`
	DeletedAt     *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

// InboxEntry represents an in-app notification in a user's inbox
type InboxEntry struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	ApplicationID  uuid.UUID  `json:"application_id" db:"application_id"`
	UserID         string     `json:"user_id" db:"user_id"`
	NotificationID *uuid.UUID `json:"notification_id,omitempty" db:"notification_id"`
	Title          string     `json:"title" db:"title"`
	Body           string     `json:"body" db:"body"`
	Type           *string    `json:"type,omitempty" db:"type"`
	ActionURL      *string    `json:"action_url,omitempty" db:"action_url"`
	ActionText     *string    `json:"action_text,omitempty" db:"action_text"`
	IconURL        *string    `json:"icon_url,omitempty" db:"icon_url"`
	ImageURL       *string    `json:"image_url,omitempty" db:"image_url"`
	IsRead         bool       `json:"is_read" db:"is_read"`
	IsArchived     bool       `json:"is_archived" db:"is_archived"`
	ReadAt         *time.Time `json:"read_at,omitempty" db:"read_at"`
	ArchivedAt     *time.Time `json:"archived_at,omitempty" db:"archived_at"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty" db:"expires_at"`
	Metadata       JSONB      `json:"metadata,omitempty" db:"metadata"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

// Datasource represents an external API data source for bulk sending
type Datasource struct {
	ID            uuid.UUID `json:"id" db:"id"`
	ApplicationID uuid.UUID `json:"application_id" db:"application_id"`
	Name          string    `json:"name" db:"name"`
	BaseURL       string    `json:"base_url" db:"base_url"`
	AuthType      string    `json:"auth_type" db:"auth_type"` // bearer, basic, api_key
	AuthConfig    JSONB     `json:"auth_config" db:"auth_config"`
	Endpoints     JSONB     `json:"endpoints" db:"endpoints"`
	Active        bool      `json:"active" db:"active"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// APIKey represents an API key for authentication
type APIKey struct {
	ID                 uuid.UUID   `json:"id" db:"id"`
	ApplicationID      uuid.UUID   `json:"application_id" db:"application_id"`
	Name               string      `json:"name" db:"name"`
	Description        *string     `json:"description,omitempty" db:"description"`
	KeyHash            string      `json:"-" db:"key_hash"` // Never expose in JSON
	KeyPrefix          string      `json:"key_prefix" db:"key_prefix"`
	Environment        Environment `json:"environment" db:"environment"`
	Scopes             []string    `json:"scopes" db:"scopes"`
	RateLimitPerMinute *int        `json:"rate_limit_per_minute,omitempty" db:"rate_limit_per_minute"`
	RateLimitPerHour   *int        `json:"rate_limit_per_hour,omitempty" db:"rate_limit_per_hour"`
	RateLimitPerDay    *int        `json:"rate_limit_per_day,omitempty" db:"rate_limit_per_day"`
	LastUsedAt         *time.Time  `json:"last_used_at,omitempty" db:"last_used_at"`
	UsageCount         int         `json:"usage_count" db:"usage_count"`
	AllowedIPs         []string    `json:"allowed_ips,omitempty" db:"allowed_ips"`
	IsActive           bool        `json:"is_active" db:"is_active"`
	ExpiresAt          *time.Time  `json:"expires_at,omitempty" db:"expires_at"`
	Metadata           JSONB       `json:"metadata,omitempty" db:"metadata"`
	CreatedAt          time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time   `json:"updated_at" db:"updated_at"`
	CreatedBy          *uuid.UUID  `json:"created_by,omitempty" db:"created_by"`
	DeletedAt          *time.Time  `json:"deleted_at,omitempty" db:"deleted_at"`
}

// DeviceToken represents a device token for push notifications
type DeviceToken struct {
	ID                 uuid.UUID  `json:"id" db:"id"`
	ApplicationID      uuid.UUID  `json:"application_id" db:"application_id"`
	UserID             string     `json:"user_id" db:"user_id"`
	Token              string     `json:"token" db:"token"`
	Platform           Platform   `json:"platform" db:"platform"`
	DeviceID           *string    `json:"device_id,omitempty" db:"device_id"`
	DeviceName         *string    `json:"device_name,omitempty" db:"device_name"`
	AppVersion         *string    `json:"app_version,omitempty" db:"app_version"`
	OSVersion          *string    `json:"os_version,omitempty" db:"os_version"`
	IsActive           bool       `json:"is_active" db:"is_active"`
	LastValidatedAt    *time.Time `json:"last_validated_at,omitempty" db:"last_validated_at"`
	ValidationFailures int        `json:"validation_failures" db:"validation_failures"`
	LastUsedAt         *time.Time `json:"last_used_at,omitempty" db:"last_used_at"`
	NotificationCount  int        `json:"notification_count" db:"notification_count"`
	Preferences        JSONB      `json:"preferences,omitempty" db:"preferences"`
	Metadata           JSONB      `json:"metadata,omitempty" db:"metadata"`
	CreatedAt          time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt          *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

// ProviderConfig represents a database-stored provider configuration
type ProviderConfig struct {
	ID            uuid.UUID `json:"id"         db:"id"`
	ApplicationID uuid.UUID `json:"application_id" db:"application_id"`
	Name          string    `json:"name"       db:"name"`
	Channel       Channel   `json:"channel"    db:"channel"`
	Provider      string    `json:"provider"   db:"provider"`
	Config        JSONB     `json:"config"     db:"config"`
	IsDefault     bool      `json:"is_default" db:"is_default"`
	IsActive      bool      `json:"is_active"  db:"is_active"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// Custom errors for domain
var (
	ErrUserNotFound              = fmt.Errorf("user not found")
	ErrApplicationNotFound       = fmt.Errorf("application not found")
	ErrApplicationAccessDenied  = fmt.Errorf("access to application denied")
	ErrDatasourceNotFound        = fmt.Errorf("datasource not found")
	ErrBatchNotFound             = fmt.Errorf("batch not found")
	ErrProviderConfigNotFound     = fmt.Errorf("provider config not found")
)
