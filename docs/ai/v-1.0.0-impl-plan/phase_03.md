# Phase 03: Single Notification API & Authentication

## Objectives
- Implement API key authentication middleware
- Create REST API for single notification sends
- Add request validation
- Implement notification status查询 endpoints
- Create template management APIs

---

## 3.1 API Key Authentication

### Middleware Implementation
```go
// internal/api/middleware.go
package api

import (
    "context"
    "crypto/subtle"
    "strings"
    "time"
    
    "github.com/gofiber/fiber/v2"
    "golang.org/x/crypto/bcrypt"
)

type contextKey string

const (
    ContextKeyAPIKey contextKey = "api_key"
    ContextKeyScopes contextKey = "scopes"
)

type APIKeyStore interface {
    GetAPIKeyByHash(ctx context.Context, keyHash string) (*domain.APIKey, error)
    UpdateLastUsed(ctx context.Context, keyID uuid.UUID) error
}

func AuthMiddleware(store APIKeyStore) fiber.Handler {
    return func(c *fiber.Ctx) error {
        // Extract API key from Authorization header
        auth := c.Get("Authorization")
        if auth == "" {
            return c.Status(401).JSON(fiber.Map{
                "error": "missing authorization header",
            })
        }

        // Expected format: "Bearer buzz_xxx..."
        parts := strings.SplitN(auth, " ", 2)
        if len(parts) != 2 || parts[0] != "Bearer" {
            return c.Status(401).JSON(fiber.Map{
                "error": "invalid authorization format",
            })
        }

        apiKey := parts[1]
        
        // Validate key format
        if !strings.HasPrefix(apiKey, "buzz_") {
            return c.Status(401).JSON(fiber.Map{
                "error": "invalid api key format",
            })
        }

        // Hash and lookup key
        keyHash := hashAPIKey(apiKey)
        key, err := store.GetAPIKeyByHash(c.Context(), keyHash)
        if err != nil {
            return c.Status(401).JSON(fiber.Map{
                "error": "invalid api key",
            })
        }

        // Check if active
        if !key.Active {
            return c.Status(401).JSON(fiber.Map{
                "error": "api key is inactive",
            })
        }

        // Check expiration
        if key.ExpiresAt != nil && key.ExpiresAt.Before(time.Now()) {
            return c.Status(401).JSON(fiber.Map{
                "error": "api key has expired",
            })
        }

        // Store key info in context
        c.Locals(string(ContextKeyAPIKey), key)
        c.Locals(string(ContextKeyScopes), key.Scopes)

        // Update last used timestamp (async)
        go store.UpdateLastUsed(context.Background(), key.ID)

        return c.Next()
    }
}

func RequireScope(scope string) fiber.Handler {
    return func(c *fiber.Ctx) error {
        scopes := c.Locals(string(ContextKeyScopes)).([]string)
        
        for _, s := range scopes {
            if s == scope {
                return c.Next()
            }
        }

        return c.Status(403).JSON(fiber.Map{
            "error": "insufficient permissions",
            "required_scope": scope,
        })
    }
}

func hashAPIKey(key string) string {
    hash, _ := bcrypt.GenerateFromPassword([]byte(key), bcrypt.DefaultCost)
    return string(hash)
}
```

### API Key Repository
```go
// internal/store/api_keys.go
package store

import (
    "context"
    "database/sql"
    "buzz-service/internal/domain"
    "github.com/google/uuid"
    "github.com/lib/pq"
)

func (s *PostgresStore) GetAPIKeyByHash(ctx context.Context, keyHash string) (*domain.APIKey, error) {
    query := `
        SELECT id, name, key_hash, key_prefix, scopes, rate_limit,
               active, expires_at, last_used_at, created_by, created_at
        FROM api_keys
        WHERE key_hash = $1 AND active = true
    `
    
    var key domain.APIKey
    err := s.db.QueryRowContext(ctx, query, keyHash).Scan(
        &key.ID, &key.Name, &key.KeyHash, &key.KeyPrefix,
        pq.Array(&key.Scopes), &key.RateLimit,
        &key.Active, &key.ExpiresAt, &key.LastUsedAt,
        &key.CreatedBy, &key.CreatedAt,
    )
    
    if err == sql.ErrNoRows {
        return nil, domain.ErrAPIKeyNotFound
    }
    
    return &key, err
}

func (s *PostgresStore) UpdateLastUsed(ctx context.Context, keyID uuid.UUID) error {
    query := "UPDATE api_keys SET last_used_at = NOW() WHERE id = $1"
    _, err := s.db.ExecContext(ctx, query, keyID)
    return err
}
```

---

## 3.2 Request Validation

```go
// internal/api/validation.go
package api

import (
    "fmt"
    "regexp"
    "buzz-service/internal/domain"
)

var (
    emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
    phoneRegex = regexp.MustCompile(`^\+?[1-9]\d{1,14}$`) // E.164 format
)

type SendNotificationRequest struct {
    To              string                 `json:"to"`
    Channel         domain.Channel         `json:"channel"`
    Priority        domain.Priority        `json:"priority"`
    Template        string                 `json:"template,omitempty"`
    Subject         string                 `json:"subject,omitempty"`
    Body            string                 `json:"body,omitempty"`
    Data            map[string]interface{} `json:"data,omitempty"`
    IdempotencyKey  string                 `json:"idempotency_key,omitempty"`
    ScheduledFor    *time.Time             `json:"scheduled_for,omitempty"`
}

func (r *SendNotificationRequest) Validate() error {
    if r.To == "" {
        return fmt.Errorf("'to' field is required")
    }

    if r.Channel == "" {
        return fmt.Errorf("'channel' field is required")
    }

    // Validate channel
    validChannels := map[domain.Channel]bool{
        domain.ChannelEmail: true,
        domain.ChannelSMS:   true,
        domain.ChannelPush:  true,
        domain.ChannelInApp: true,
    }
    if !validChannels[r.Channel] {
        return fmt.Errorf("invalid channel: %s", r.Channel)
    }

    // Validate 'to' address format based on channel
    switch r.Channel {
    case domain.ChannelEmail:
        if !emailRegex.MatchString(r.To) {
            return fmt.Errorf("invalid email address")
        }
    case domain.ChannelSMS:
        if !phoneRegex.MatchString(r.To) {
            return fmt.Errorf("invalid phone number (use E.164 format)")
        }
    }

    // Either template or body must be provided
    if r.Template == "" && r.Body == "" {
        return fmt.Errorf("either 'template' or 'body' must be provided")
    }

    // Email requires subject
    if r.Channel == domain.ChannelEmail && r.Subject == "" && r.Template == "" {
        return fmt.Errorf("'subject' is required for email notifications")
    }

    // Priority validation
    if r.Priority == "" {
        r.Priority = domain.PriorityNormal
    }
    validPriorities := map[domain.Priority]bool{
        domain.PriorityHigh:   true,
        domain.PriorityNormal: true,
        domain.PriorityLow:    true,
    }
    if !validPriorities[r.Priority] {
        return fmt.Errorf("invalid priority: %s", r.Priority)
    }

    return nil
}
```

---

## 3.3 Notification Handler

```go
// internal/api/handler.go
package api

import (
    "fmt"
    "time"
    
    "github.com/gofiber/fiber/v2"
    "github.com/google/uuid"
    "buzz-service/internal/domain"
    "buzz-service/internal/queue"
    "buzz-service/internal/store"
)

type NotificationHandler struct {
    store    *store.PostgresStore
    producer *queue.Producer
}

func NewNotificationHandler(store *store.PostgresStore, producer *queue.Producer) *NotificationHandler {
    return &NotificationHandler{
        store:    store,
        producer: producer,
    }
}

// SendNotification handles POST /api/v1/notifications
func (h *NotificationHandler) SendNotification(c *fiber.Ctx) error {
    var req SendNotificationRequest
    if err := c.BodyParser(&req); err != nil {
        return c.Status(400).JSON(fiber.Map{
            "error": "invalid request body",
            "details": err.Error(),
        })
    }

    // Validate request
    if err := req.Validate(); err != nil {
        return c.Status(400).JSON(fiber.Map{
            "error": "validation failed",
            "details": err.Error(),
        })
    }

    ctx := c.Context()

    // Check idempotency
    if req.IdempotencyKey != "" {
        existing, err := h.store.GetNotificationByIdempotencyKey(ctx, req.IdempotencyKey)
        if err == nil {
            // Already exists, return existing notification
            return c.Status(200).JSON(fiber.Map{
                "id":     existing.ID,
                "status": existing.Status,
                "message": "notification already exists (idempotency)",
            })
        }
    }

    // Process template if provided
    var body, subject string
    if req.Template != "" {
        template, err := h.store.GetTemplateByName(ctx, req.Template)
        if err != nil {
            return c.Status(404).JSON(fiber.Map{
                "error": "template not found",
                "template": req.Template,
            })
        }

        // Render template with data
        body = renderTemplate(template.Body, req.Data)
        if template.Subject != "" {
            subject = renderTemplate(template.Subject, req.Data)
        } else if req.Subject != "" {
            subject = req.Subject
        }
    } else {
        body = req.Body
        subject = req.Subject
    }

    // Create notification record
    notification := &domain.Notification{
        ID:            uuid.New(),
        ToAddress:     req.To,
        Channel:       req.Channel,
        TemplateName:  req.Template,
        Subject:       subject,
        Body:          body,
        TemplateData:  req.Data,
        Priority:      req.Priority,
        Status:        domain.StatusQueued,
        MaxAttempts:   3,
        ScheduledFor:  req.ScheduledFor,
        CreatedAt:     time.Now(),
        UpdatedAt:     time.Now(),
    }

    // Save to database
    if err := h.store.CreateNotification(ctx, notification); err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "failed to create notification",
            "details": err.Error(),
        })
    }

    // Enqueue for processing
    if err := h.producer.EnqueueNotification(ctx, notification); err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "failed to enqueue notification",
            "details": err.Error(),
        })
    }

    return c.Status(202).JSON(fiber.Map{
        "id":      notification.ID,
        "status":  "queued",
        "message": "notification queued for delivery",
    })
}

// GetNotification handles GET /api/v1/notifications/:id
func (h *NotificationHandler) GetNotification(c *fiber.Ctx) error {
    idStr := c.Params("id")
    id, err := uuid.Parse(idStr)
    if err != nil {
        return c.Status(400).JSON(fiber.Map{
            "error": "invalid notification id",
        })
    }

    notification, err := h.store.GetNotification(c.Context(), id)
    if err != nil {
        return c.Status(404).JSON(fiber.Map{
            "error": "notification not found",
        })
    }

    return c.JSON(notification)
}

// ListNotifications handles GET /api/v1/notifications
func (h *NotificationHandler) ListNotifications(c *fiber.Ctx) error {
    // Parse query parameters
    status := c.Query("status")
    channel := c.Query("channel")
    recipientID := c.Query("recipient_id")
    limit := c.QueryInt("limit", 20)
    offset := c.QueryInt("offset", 0)

    filters := store.NotificationFilters{
        Status:      status,
        Channel:     channel,
        RecipientID: recipientID,
        Limit:       limit,
        Offset:      offset,
    }

    notifications, total, err := h.store.ListNotifications(c.Context(), filters)
    if err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "failed to fetch notifications",
        })
    }

    return c.JSON(fiber.Map{
        "data":   notifications,
        "total":  total,
        "limit":  limit,
        "offset": offset,
    })
}

// Helper function to render templates
func renderTemplate(template string, data map[string]interface{}) string {
    result := template
    for key, value := range data {
        placeholder := fmt.Sprintf("{{%s}}", key)
        result = strings.ReplaceAll(result, placeholder, fmt.Sprint(value))
    }
    return result
}
```

---

## 3.4 Template Management APIs

```go
// internal/api/templates.go
package api

import (
    "github.com/gofiber/fiber/v2"
    "github.com/google/uuid"
    "buzz-service/internal/domain"
)

type TemplateHandler struct {
    store *store.PostgresStore
}

func NewTemplateHandler(store *store.PostgresStore) *TemplateHandler {
    return &TemplateHandler{store: store}
}

// CreateTemplate handles POST /api/v1/templates
func (h *TemplateHandler) CreateTemplate(c *fiber.Ctx) error {
    var req struct {
        Name     string                 `json:"name"`
        Channel  domain.Channel         `json:"channel"`
        Subject  string                 `json:"subject,omitempty"`
        Body     string                 `json:"body"`
        Metadata map[string]interface{} `json:"metadata,omitempty"`
    }

    if err := c.BodyParser(&req); err != nil {
        return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
    }

    // Validation
    if req.Name == "" || req.Body == "" {
        return c.Status(400).JSON(fiber.Map{
            "error": "name and body are required",
        })
    }

    template := &domain.Template{
        ID:       uuid.New(),
        Name:     req.Name,
        Channel:  req.Channel,
        Subject:  req.Subject,
        Body:     req.Body,
        Metadata: req.Metadata,
        Active:   true,
    }

    if err := h.store.CreateTemplate(c.Context(), template); err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "failed to create template",
        })
    }

    return c.Status(201).JSON(template)
}

// GetTemplate handles GET /api/v1/templates/:name
func (h *TemplateHandler) GetTemplate(c *fiber.Ctx) error {
    name := c.Params("name")
    
    template, err := h.store.GetTemplateByName(c.Context(), name)
    if err != nil {
        return c.Status(404).JSON(fiber.Map{
            "error": "template not found",
        })
    }

    return c.JSON(template)
}

// ListTemplates handles GET /api/v1/templates
func (h *TemplateHandler) ListTemplates(c *fiber.Ctx) error {
    channel := c.Query("channel")
    activeOnly := c.QueryBool("active", true)

    templates, err := h.store.ListTemplates(c.Context(), channel, activeOnly)
    if err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "failed to fetch templates",
        })
    }

    return c.JSON(fiber.Map{
        "data": templates,
        "total": len(templates),
    })
}

// UpdateTemplate handles PATCH /api/v1/templates/:name
func (h *TemplateHandler) UpdateTemplate(c *fiber.Ctx) error {
    name := c.Params("name")
    
    var req struct {
        Subject  *string                 `json:"subject"`
        Body     *string                 `json:"body"`
        Metadata map[string]interface{}  `json:"metadata"`
        Active   *bool                   `json:"active"`
    }

    if err := c.BodyParser(&req); err != nil {
        return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
    }

    if err := h.store.UpdateTemplate(c.Context(), name, req); err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "failed to update template",
        })
    }

    return c.JSON(fiber.Map{"message": "template updated"})
}
```

---

## 3.5 Updated Routes

```go
// internal/api/routes.go
package api

import (
    "github.com/gofiber/fiber/v2"
    "github.com/gofiber/fiber/v2/middleware/cors"
    "github.com/gofiber/fiber/v2/middleware/recover"
    "github.com/gofiber/fiber/v2/middleware/requestid"
    "buzz-service/internal/queue"
    "buzz-service/internal/store"
)

func SetupRoutes(
    app *fiber.App,
    db *store.PostgresStore,
    producer *queue.Producer,
) {
    // Global middleware
    app.Use(recover.New())
    app.Use(requestid.New())
    app.Use(cors.New(cors.Config{
        AllowOrigins: "*",
        AllowMethods: "GET,POST,PATCH,DELETE",
        AllowHeaders: "Origin,Content-Type,Authorization",
    }))

    // Public health check
    app.Get("/health", HealthCheck(db))

    // API v1
    v1 := app.Group("/api/v1")
    
    // Authenticated routes
    v1.Use(AuthMiddleware(db))

    // Notifications
    notifHandler := NewNotificationHandler(db, producer)
    notifications := v1.Group("/notifications")
    notifications.Post("/", RequireScope("notification:send"), notifHandler.SendNotification)
    notifications.Get("/", RequireScope("notification:read"), notifHandler.ListNotifications)
    notifications.Get("/:id", RequireScope("notification:read"), notifHandler.GetNotification)

    // Templates
    templateHandler := NewTemplateHandler(db)
    templates := v1.Group("/templates")
    templates.Post("/", RequireScope("template:write"), templateHandler.CreateTemplate)
    templates.Get("/", RequireScope("template:read"), templateHandler.ListTemplates)
    templates.Get("/:name", RequireScope("template:read"), templateHandler.GetTemplate)
    templates.Patch("/:name", RequireScope("template:write"), templateHandler.UpdateTemplate)
}
```

---

## 3.6 OpenAPI Specification

```yaml
# docs/openapi.yaml
openapi: 3.0.3
info:
  title: Buzz Notification Service API
  version: 1.0.0
  description: Unified notification delivery service for email, SMS, push, and in-app notifications

servers:
  - url: http://localhost:8080/api/v1
    description: Local development

security:
  - ApiKeyAuth: []

paths:
  /notifications:
    post:
      summary: Send a single notification
      operationId: sendNotification
      tags: [Notifications]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SendNotificationRequest'
      responses:
        '202':
          description: Notification queued successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/NotificationResponse'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
    
    get:
      summary: List notifications
      operationId: listNotifications
      tags: [Notifications]
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [queued, sent, failed, skipped]
        - name: channel
          in: query
          schema:
            type: string
            enum: [email, sms, push, in_app]
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: List of notifications
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/NotificationList'

  /notifications/{id}:
    get:
      summary: Get notification status
      operationId: getNotification
      tags: [Notifications]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Notification details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Notification'
        '404':
          $ref: '#/components/responses/NotFound'

components:
  securitySchemes:
    ApiKeyAuth:
      type: http
      scheme: bearer
      bearerFormat: API Key

  schemas:
    SendNotificationRequest:
      type: object
      required: [to, channel]
      properties:
        to:
          type: string
          description: Recipient address (email, phone, or device token)
          example: "student@example.com"
        channel:
          type: string
          enum: [email, sms, push, in_app]
        priority:
          type: string
          enum: [high, normal, low]
          default: normal
        template:
          type: string
          description: Template name to use
          example: "assignment_reminder"
        subject:
          type: string
          description: Subject line (required for email if no template)
        body:
          type: string
          description: Message body (required if no template)
        data:
          type: object
          description: Template variables
          additionalProperties: true
        idempotency_key:
          type: string
          description: Unique key to prevent duplicate sends
        scheduled_for:
          type: string
          format: date-time
          description: Schedule notification for future delivery

    NotificationResponse:
      type: object
      properties:
        id:
          type: string
          format: uuid
        status:
          type: string
          enum: [queued, sent, failed, skipped]
        message:
          type: string

  responses:
    BadRequest:
      description: Invalid request
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
    
    Unauthorized:
      description: Unauthorized
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
    
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
```

---

## 3.7 Deliverables

✅ API key authentication middleware
✅ Scope-based authorization
✅ Single notification send endpoint
✅ Notification status query endpoints
✅ Template management APIs
✅ Request validation
✅ OpenAPI specification
✅ Error handling

---

## 3.8 Testing Phase 3

```bash
# Create test API key
psql -U buzz_user -d buzz_service -c "
INSERT INTO api_keys (name, key_hash, key_prefix, scopes, active) 
VALUES ('Test Key', '\$2a\$10\$...', 'buzz_tes', ARRAY['notification:send', 'notification:read'], true);
"

# Test send notification
curl -X POST http://localhost:8080/api/v1/notifications \
  -H "Authorization: Bearer buzz_test_key_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "channel": "email",
    "subject": "Test",
    "body": "Hello, World!",
    "priority": "normal"
  }'

# Test get notification
curl http://localhost:8080/api/v1/notifications/{id} \
  -H "Authorization: Bearer buzz_test_key_abc123"
```

---

## Next Phase
**Phase 04**: Redis queue setup and worker implementation for processing notifications
