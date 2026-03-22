# Phase 02: Database Schema & Migration System

## Objectives
- Design complete database schema for notifications system
- Implement migration system
- Create database access layer (repositories)
- Add database seed data for testing

---

## 2.1 Complete Database Schema

### Core Tables

#### Data Sources (for bulk operations)
```sql
-- migrations/001_datasources.sql

CREATE TABLE datasources (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(100) UNIQUE NOT NULL,
    base_url      TEXT NOT NULL,
    auth_type     VARCHAR(20) NOT NULL,        -- bearer, basic, api_key
    auth_config   JSONB NOT NULL,              -- {token: "...", header: "..."}
    endpoints     JSONB NOT NULL,              -- endpoint configurations
    active        BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_datasources_name ON datasources(name);
CREATE INDEX idx_datasources_active ON datasources(active);

COMMENT ON TABLE datasources IS 'External systems that provide recipient data';
COMMENT ON COLUMN datasources.endpoints IS 'Maps endpoint names to paths and response formats';
```

#### Notification Templates
```sql
-- migrations/002_templates.sql

CREATE TABLE templates (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(100) UNIQUE NOT NULL,
    channel       VARCHAR(20) NOT NULL,        -- email, sms, push, in_app, all
    subject       TEXT,                         -- for email
    body          TEXT NOT NULL,                -- supports {{variable}} syntax
    metadata      JSONB,                        -- channel-specific config
    active        BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_templates_name ON templates(name);
CREATE INDEX idx_templates_channel ON templates(channel);

COMMENT ON COLUMN templates.body IS 'Template body with {{variable}} placeholders';
COMMENT ON COLUMN templates.metadata IS 'Extra config like SMS sender_id, email from_name, etc.';
```

#### Batches (bulk sends)
```sql
-- migrations/003_batches.sql

CREATE TABLE batches (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    datasource_id     UUID REFERENCES datasources(id) ON DELETE SET NULL,
    datasource_name   VARCHAR(100),                 -- denormalized for reporting
    endpoint_name     VARCHAR(100),
    endpoint_params   JSONB,
    template_name     VARCHAR(100) NOT NULL,
    channel           VARCHAR(20) NOT NULL,
    priority          VARCHAR(20) DEFAULT 'normal', -- high, normal, low
    template_data     JSONB,                        -- variables for template
    
    -- Status tracking
    status            VARCHAR(20) DEFAULT 'fetching', -- fetching, queued, delivering, completed, failed
    total             INT DEFAULT 0,
    sent              INT DEFAULT 0,
    failed            INT DEFAULT 0,
    skipped           INT DEFAULT 0,
    
    -- Metadata
    idempotency_key   VARCHAR(255) UNIQUE,
    error_message     TEXT,
    started_at        TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_batches_status ON batches(status);
CREATE INDEX idx_batches_idempotency ON batches(idempotency_key);
CREATE INDEX idx_batches_created ON batches(created_at DESC);
CREATE INDEX idx_batches_datasource ON batches(datasource_id);

COMMENT ON TABLE batches IS 'Bulk notification send operations';
```

#### Notifications (single + bulk)
```sql
-- migrations/004_notifications.sql

CREATE TABLE notifications (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id          UUID REFERENCES batches(id) ON DELETE CASCADE,
    
    -- Recipient
    recipient_id      VARCHAR(100),                  -- external user ID
    recipient_name    VARCHAR(255),
    to_address        TEXT NOT NULL,                 -- email/phone/device_token
    
    -- Message
    channel           VARCHAR(20) NOT NULL,          -- email, sms, push, in_app
    template_name     VARCHAR(100),
    subject           TEXT,
    body              TEXT NOT NULL,
    template_data     JSONB,
    
    -- Delivery
    priority          VARCHAR(20) DEFAULT 'normal',
    status            VARCHAR(20) DEFAULT 'queued',  -- queued, sent, failed, skipped
    attempts          INT DEFAULT 0,
    max_attempts      INT DEFAULT 3,
    last_error        TEXT,
    
    -- Provider info
    provider_name     VARCHAR(50),                   -- ses, notifylk, fcm, etc.
    provider_response JSONB,                         -- message_id, etc.
    
    -- Timing
    scheduled_for     TIMESTAMPTZ,                   -- for delayed sends
    sent_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_batch ON notifications(batch_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_channel ON notifications(channel);
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

COMMENT ON TABLE notifications IS 'Individual notification records (single and bulk)';
```

#### In-App Inbox
```sql
-- migrations/005_inbox.sql

CREATE TABLE inbox (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id   UUID REFERENCES notifications(id) ON DELETE CASCADE,
    user_id           VARCHAR(100) NOT NULL,
    
    -- Display
    title             TEXT NOT NULL,
    body              TEXT NOT NULL,
    metadata          JSONB,                         -- deep_link, action_url, etc.
    
    -- Status
    read              BOOLEAN DEFAULT FALSE,
    read_at           TIMESTAMPTZ,
    archived          BOOLEAN DEFAULT FALSE,
    archived_at       TIMESTAMPTZ,
    
    -- Timing
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inbox_user ON inbox(user_id);
CREATE INDEX idx_inbox_user_unread ON inbox(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_inbox_user_created ON inbox(user_id, created_at DESC);
CREATE INDEX idx_inbox_notification ON inbox(notification_id);

COMMENT ON TABLE inbox IS 'User inbox for in-app notifications';
```

#### API Keys
```sql
-- migrations/006_api_keys.sql

CREATE TABLE api_keys (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(100) NOT NULL,
    key_hash      VARCHAR(255) UNIQUE NOT NULL,  -- bcrypt hash of the key
    key_prefix    VARCHAR(20) NOT NULL,          -- first 8 chars for identification
    
    -- Permissions
    scopes        TEXT[] DEFAULT ARRAY['notification:send'],
    rate_limit    INT DEFAULT 1000,               -- requests per minute
    
    -- Status
    active        BOOLEAN DEFAULT TRUE,
    expires_at    TIMESTAMPTZ,
    last_used_at  TIMESTAMPTZ,
    
    -- Metadata
    created_by    VARCHAR(100),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(active);

COMMENT ON TABLE api_keys IS 'API keys for authentication';
```

---

## 2.2 Migration System

### Migration Runner
```go
// internal/store/migrations.go
package store

import (
    "context"
    "database/sql"
    "embed"
    "fmt"
    "sort"
    "strings"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

type Migration struct {
    Version int
    Name    string
    SQL     string
}

func (s *PostgresStore) Migrate(ctx context.Context) error {
    // Create migrations table if not exists
    _, err := s.db.ExecContext(ctx, `
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        )
    `)
    if err != nil {
        return fmt.Errorf("failed to create migrations table: %w", err)
    }

    // Get current version
    var currentVersion int
    err = s.db.QueryRowContext(ctx, 
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
    ).Scan(&currentVersion)
    if err != nil {
        return fmt.Errorf("failed to get current version: %w", err)
    }

    // Load migrations
    migrations, err := loadMigrations()
    if err != nil {
        return err
    }

    // Apply pending migrations
    for _, m := range migrations {
        if m.Version <= currentVersion {
            continue
        }

        if err := s.applyMigration(ctx, m); err != nil {
            return fmt.Errorf("failed to apply migration %d: %w", m.Version, err)
        }
    }

    return nil
}

func loadMigrations() ([]Migration, error) {
    entries, err := migrationsFS.ReadDir("migrations")
    if err != nil {
        return nil, err
    }

    var migrations []Migration
    for _, entry := range entries {
        if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
            continue
        }

        var version int
        var name string
        fmt.Sscanf(entry.Name(), "%d_%s.sql", &version, &name)

        content, err := migrationsFS.ReadFile("migrations/" + entry.Name())
        if err != nil {
            return nil, err
        }

        migrations = append(migrations, Migration{
            Version: version,
            Name:    name,
            SQL:     string(content),
        })
    }

    sort.Slice(migrations, func(i, j int) bool {
        return migrations[i].Version < migrations[j].Version
    })

    return migrations, nil
}

func (s *PostgresStore) applyMigration(ctx context.Context, m Migration) error {
    tx, err := s.db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()

    // Execute migration SQL
    if _, err := tx.ExecContext(ctx, m.SQL); err != nil {
        return err
    }

    // Record migration
    _, err = tx.ExecContext(ctx,
        "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
        m.Version, m.Name,
    )
    if err != nil {
        return err
    }

    return tx.Commit()
}
```

---

## 2.3 Domain Models

```go
// internal/domain/models.go
package domain

import (
    "time"
    "github.com/google/uuid"
)

type Channel string

const (
    ChannelEmail  Channel = "email"
    ChannelSMS    Channel = "sms"
    ChannelPush   Channel = "push"
    ChannelInApp  Channel = "in_app"
    ChannelAll    Channel = "all"
)

type Priority string

const (
    PriorityHigh   Priority = "high"
    PriorityNormal Priority = "normal"
    PriorityLow    Priority = "low"
)

type NotificationStatus string

const (
    StatusQueued  NotificationStatus = "queued"
    StatusSent    NotificationStatus = "sent"
    StatusFailed  NotificationStatus = "failed"
    StatusSkipped NotificationStatus = "skipped"
)

type BatchStatus string

const (
    BatchStatusFetching   BatchStatus = "fetching"
    BatchStatusQueued     BatchStatus = "queued"
    BatchStatusDelivering BatchStatus = "delivering"
    BatchStatusCompleted  BatchStatus = "completed"
    BatchStatusFailed     BatchStatus = "failed"
)

// Notification represents a single notification to be delivered
type Notification struct {
    ID             uuid.UUID              `json:"id"`
    BatchID        *uuid.UUID             `json:"batch_id,omitempty"`
    RecipientID    string                 `json:"recipient_id"`
    RecipientName  string                 `json:"recipient_name,omitempty"`
    ToAddress      string                 `json:"to_address"`
    Channel        Channel                `json:"channel"`
    TemplateName   string                 `json:"template_name,omitempty"`
    Subject        string                 `json:"subject,omitempty"`
    Body           string                 `json:"body"`
    TemplateData   map[string]interface{} `json:"template_data,omitempty"`
    Priority       Priority               `json:"priority"`
    Status         NotificationStatus     `json:"status"`
    Attempts       int                    `json:"attempts"`
    MaxAttempts    int                    `json:"max_attempts"`
    LastError      string                 `json:"last_error,omitempty"`
    ProviderName   string                 `json:"provider_name,omitempty"`
    ScheduledFor   *time.Time             `json:"scheduled_for,omitempty"`
    SentAt         *time.Time             `json:"sent_at,omitempty"`
    CreatedAt      time.Time              `json:"created_at"`
    UpdatedAt      time.Time              `json:"updated_at"`
}

// Batch represents a bulk notification send
type Batch struct {
    ID               uuid.UUID              `json:"id"`
    DatasourceID     *uuid.UUID             `json:"datasource_id,omitempty"`
    DatasourceName   string                 `json:"datasource_name,omitempty"`
    EndpointName     string                 `json:"endpoint_name,omitempty"`
    EndpointParams   map[string]interface{} `json:"endpoint_params,omitempty"`
    TemplateName     string                 `json:"template_name"`
    Channel          Channel                `json:"channel"`
    Priority         Priority               `json:"priority"`
    TemplateData     map[string]interface{} `json:"template_data,omitempty"`
    Status           BatchStatus            `json:"status"`
    Total            int                    `json:"total"`
    Sent             int                    `json:"sent"`
    Failed           int                    `json:"failed"`
    Skipped          int                    `json:"skipped"`
    IdempotencyKey   string                 `json:"idempotency_key,omitempty"`
    ErrorMessage     string                 `json:"error_message,omitempty"`
    StartedAt        *time.Time             `json:"started_at,omitempty"`
    CompletedAt      *time.Time             `json:"completed_at,omitempty"`
    CreatedAt        time.Time              `json:"created_at"`
    UpdatedAt        time.Time              `json:"updated_at"`
}

// Template represents a notification template
type Template struct {
    ID        uuid.UUID              `json:"id"`
    Name      string                 `json:"name"`
    Channel   Channel                `json:"channel"`
    Subject   string                 `json:"subject,omitempty"`
    Body      string                 `json:"body"`
    Metadata  map[string]interface{} `json:"metadata,omitempty"`
    Active    bool                   `json:"active"`
    CreatedAt time.Time              `json:"created_at"`
    UpdatedAt time.Time              `json:"updated_at"`
}

// InboxEntry represents an in-app notification
type InboxEntry struct {
    ID             uuid.UUID              `json:"id"`
    NotificationID uuid.UUID              `json:"notification_id"`
    UserID         string                 `json:"user_id"`
    Title          string                 `json:"title"`
    Body           string                 `json:"body"`
    Metadata       map[string]interface{} `json:"metadata,omitempty"`
    Read           bool                   `json:"read"`
    ReadAt         *time.Time             `json:"read_at,omitempty"`
    Archived       bool                   `json:"archived"`
    ArchivedAt     *time.Time             `json:"archived_at,omitempty"`
    CreatedAt      time.Time              `json:"created_at"`
}

// Datasource represents an external data provider
type Datasource struct {
    ID         uuid.UUID              `json:"id"`
    Name       string                 `json:"name"`
    BaseURL    string                 `json:"base_url"`
    AuthType   string                 `json:"auth_type"`
    AuthConfig map[string]interface{} `json:"auth_config"`
    Endpoints  map[string]interface{} `json:"endpoints"`
    Active     bool                   `json:"active"`
    CreatedAt  time.Time              `json:"created_at"`
    UpdatedAt  time.Time              `json:"updated_at"`
}
```

---

## 2.4 Repository Layer

```go
// internal/store/notifications.go
package store

import (
    "context"
    "database/sql"
    "buzz-service/internal/domain"
    "github.com/google/uuid"
)

func (s *PostgresStore) CreateNotification(ctx context.Context, n *domain.Notification) error {
    query := `
        INSERT INTO notifications (
            id, batch_id, recipient_id, recipient_name, to_address,
            channel, template_name, subject, body, template_data,
            priority, status, max_attempts, scheduled_for
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
    `
    _, err := s.db.ExecContext(ctx, query,
        n.ID, n.BatchID, n.RecipientID, n.RecipientName, n.ToAddress,
        n.Channel, n.TemplateName, n.Subject, n.Body, n.TemplateData,
        n.Priority, n.Status, n.MaxAttempts, n.ScheduledFor,
    )
    return err
}

func (s *PostgresStore) GetNotification(ctx context.Context, id uuid.UUID) (*domain.Notification, error) {
    // Implementation
    return nil, nil
}

func (s *PostgresStore) UpdateNotificationStatus(
    ctx context.Context,
    id uuid.UUID,
    status domain.NotificationStatus,
    errorMsg string,
) error {
    query := `
        UPDATE notifications
        SET status = $2,
            last_error = $3,
            attempts = attempts + 1,
            sent_at = CASE WHEN $2 = 'sent' THEN NOW() ELSE sent_at END,
            updated_at = NOW()
        WHERE id = $1
    `
    _, err := s.db.ExecContext(ctx, query, id, status, errorMsg)
    return err
}
```

---

## 2.5 Seed Data

```sql
-- migrations/999_seed_data.sql
-- Sample templates for testing

INSERT INTO templates (name, channel, subject, body, active) VALUES
('welcome_email', 'email', 'Welcome to {{institution_name}}!', 
 'Hi {{student_name}},\n\nWelcome to {{institution_name}}! Your account has been created successfully.', 
 true),

('assignment_reminder', 'all', 'Assignment Due: {{assignment_name}}',
 'Hi {{student_name}},\n\nYour assignment "{{assignment_name}}" is due on {{due_date}}.', 
 true),

('grade_posted', 'in_app', 'New Grade Posted',
 'Your grade for {{assignment_name}} has been posted: {{grade}}',
 true);

-- Sample API key (key: buzz_test_key_abc123, hashed with bcrypt)
INSERT INTO api_keys (name, key_hash, key_prefix, scopes, active) VALUES
('Test API Key', '$2a$10$...', 'buzz_tes', ARRAY['notification:send', 'notification:read'], true);
```

---

## 2.6 Deliverables

✅ Complete database schema with all tables
✅ Migration system with embedded SQL files
✅ Domain models for all entities
✅ Repository layer with basic CRUD operations
✅ Seed data for testing
✅ Proper indexing for performance
✅ Foreign key relationships
✅ Comments on tables and columns

---

## 2.7 Testing Phase 2

```bash
# Run migrations
make migrate-up

# Verify tables created
psql -U buzz_user -d buzz_service -c "\dt"

# Check sample data
psql -U buzz_user -d buzz_service -c "SELECT * FROM templates;"
```

---

## Next Phase
**Phase 03**: REST API endpoints for single notifications + authentication middleware
