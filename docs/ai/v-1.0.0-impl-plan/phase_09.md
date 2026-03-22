# Phase 09: Bulk Notifications & Datasource Integration

## Objectives
- Implement datasource registration system
- Create bulk notification API
- Add recipient fetching from external datasources
- Implement batch fan-out processor
- Add batch status tracking
- Create batch progress monitoring

---

## 9.1 Datasource Repository

```go
// internal/store/datasources.go
package store

import (
    "context"
    "database/sql"
    "buzz-service/internal/domain"
    "github.com/google/uuid"
    "github.com/lib/pq"
)

func (s *PostgresStore) CreateDatasource(ctx context.Context, ds *domain.Datasource) error {
    query := `
        INSERT INTO datasources (id, name, base_url, auth_type, auth_config, endpoints, active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `
    
    _, err := s.db.ExecContext(ctx, query,
        ds.ID, ds.Name, ds.BaseURL, ds.AuthType,
        ds.AuthConfig, ds.Endpoints, ds.Active,
    )
    return err
}

func (s *PostgresStore) GetDatasourceByName(ctx context.Context, name string) (*domain.Datasource, error) {
    query := `
        SELECT id, name, base_url, auth_type, auth_config, endpoints, active, created_at, updated_at
        FROM datasources
        WHERE name = $1
    `
    
    var ds domain.Datasource
    err := s.db.QueryRowContext(ctx, query, name).Scan(
        &ds.ID, &ds.Name, &ds.BaseURL, &ds.AuthType,
        &ds.AuthConfig, &ds.Endpoints, &ds.Active,
        &ds.CreatedAt, &ds.UpdatedAt,
    )
    
    if err == sql.ErrNoRows {
        return nil, domain.ErrDatasourceNotFound
    }
    
    return &ds, err
}

func (s *PostgresStore) ListDatasources(ctx context.Context) ([]domain.Datasource, error) {
    query := `
        SELECT id, name, base_url, auth_type, endpoints, active, created_at
        FROM datasources
        WHERE active = true
        ORDER BY name
    `
    
    rows, err := s.db.QueryContext(ctx, query)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var datasources []domain.Datasource
    for rows.Next() {
        var ds domain.Datasource
        err := rows.Scan(
            &ds.ID, &ds.Name, &ds.BaseURL, &ds.AuthType,
            &ds.Endpoints, &ds.Active, &ds.CreatedAt,
        )
        if err != nil {
            return nil, err
        }
        datasources = append(datasources, ds)
    }

    return datasources, nil
}
```

---

## 9.2 Datasource Client

```go
// internal/datasource/client.go
package datasource

import (
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "strings"
    "time"

    "buzz-service/internal/domain"
)

type Client struct {
    httpClient *http.Client
}

func NewClient() *Client {
    return &Client{
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

type Recipient struct {
    ID          string `json:"id"`
    Name        string `json:"name"`
    Email       string `json:"email"`
    Phone       string `json:"phone"`
    DeviceToken string `json:"device_token"`
}

// FetchRecipients fetches recipients from a registered datasource
func (c *Client) FetchRecipients(
    ctx context.Context,
    ds *domain.Datasource,
    endpointName string,
    params map[string]interface{},
) ([]Recipient, error) {
    // Get endpoint configuration
    endpointConfig, ok := ds.Endpoints[endpointName].(map[string]interface{})
    if !ok {
        return nil, fmt.Errorf("endpoint %s not found", endpointName)
    }

    // Build URL
    path := endpointConfig["path"].(string)
    method := endpointConfig["method"].(string)
    
    // Replace path parameters
    for key, value := range params {
        placeholder := fmt.Sprintf("{%s}", key)
        path = strings.ReplaceAll(path, placeholder, fmt.Sprint(value))
    }

    url := ds.BaseURL + path

    // Add query parameters for GET requests
    if method == "GET" && len(params) > 0 {
        // Extract query params (non-path params)
        queryParams := make([]string, 0)
        for key, value := range params {
            if !strings.Contains(path, fmt.Sprintf("{%s}", key)) {
                queryParams = append(queryParams, fmt.Sprintf("%s=%v", key, value))
            }
        }
        if len(queryParams) > 0 {
            url += "?" + strings.Join(queryParams, "&")
        }
    }

    // Create request
    req, err := http.NewRequestWithContext(ctx, method, url, nil)
    if err != nil {
        return nil, fmt.Errorf("failed to create request: %w", err)
    }

    // Add authentication
    if err := c.addAuth(req, ds); err != nil {
        return nil, err
    }

    // Execute request
    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("request failed: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        body, _ := io.ReadAll(resp.Body)
        return nil, fmt.Errorf("datasource returned status %d: %s", resp.StatusCode, string(body))
    }

    // Parse response
    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    var response map[string]interface{}
    if err := json.Unmarshal(body, &response); err != nil {
        return nil, fmt.Errorf("failed to parse response: %w", err)
    }

    // Extract recipients using response format config
    responseFormat := endpointConfig["response_format"].(map[string]interface{})
    recipientsKey := responseFormat["recipients_key"].(string)
    
    recipientsData, ok := response[recipientsKey].([]interface{})
    if !ok {
        return nil, fmt.Errorf("recipients data not found at key: %s", recipientsKey)
    }

    // Map to Recipient struct
    recipients := make([]Recipient, 0, len(recipientsData))
    emailField := responseFormat["email_field"].(string)
    phoneField := responseFormat["phone_field"].(string)
    nameField := responseFormat["name_field"].(string)
    
    for _, item := range recipientsData {
        data := item.(map[string]interface{})
        
        recipient := Recipient{
            ID:    getString(data, "id"),
            Name:  getString(data, nameField),
            Email: getString(data, emailField),
            Phone: getString(data, phoneField),
        }
        
        if tokenField, ok := responseFormat["device_token_field"].(string); ok {
            recipient.DeviceToken = getString(data, tokenField)
        }

        recipients = append(recipients, recipient)
    }

    return recipients, nil
}

func (c *Client) addAuth(req *http.Request, ds *domain.Datasource) error {
    switch ds.AuthType {
    case "bearer":
        token := ds.AuthConfig["token"].(string)
        req.Header.Set("Authorization", "Bearer "+token)
    
    case "basic":
        username := ds.AuthConfig["username"].(string)
        password := ds.AuthConfig["password"].(string)
        req.SetBasicAuth(username, password)
    
    case "api_key":
        headerName := ds.AuthConfig["header"].(string)
        apiKey := ds.AuthConfig["key"].(string)
        req.Header.Set(headerName, apiKey)
    
    default:
        return fmt.Errorf("unsupported auth type: %s", ds.AuthType)
    }

    return nil
}

func getString(data map[string]interface{}, key string) string {
    if val, ok := data[key]; ok && val != nil {
        return fmt.Sprint(val)
    }
    return ""
}

// FetchRecipientsWithPagination handles paginated endpoints
func (c *Client) FetchRecipientsWithPagination(
    ctx context.Context,
    ds *domain.Datasource,
    endpointName string,
    params map[string]interface{},
) ([]Recipient, error) {
    allRecipients := make([]Recipient, 0)
    page := 1
    perPage := 100

    for {
        paginatedParams := make(map[string]interface{})
        for k, v := range params {
            paginatedParams[k] = v
        }
        paginatedParams["page"] = page
        paginatedParams["per_page"] = perPage

        recipients, err := c.FetchRecipients(ctx, ds, endpointName, paginatedParams)
        if err != nil {
            return nil, err
        }

        if len(recipients) == 0 {
            break
        }

        allRecipients = append(allRecipients, recipients...)

        // If less than per_page, we've reached the end
        if len(recipients) < perPage {
            break
        }

        page++
    }

    return allRecipients, nil
}
```

---

## 9.3 Batch Processor

```go
// internal/batch/processor.go
package batch

import (
    "context"
    "fmt"

    "buzz-service/internal/datasource"
    "buzz-service/internal/domain"
    "buzz-service/internal/queue"
    "buzz-service/internal/store"
    "buzz-service/pkg/logger"
    "github.com/google/uuid"
)

type Processor struct {
    store       *store.PostgresStore
    datasource  *datasource.Client
    producer    *queue.Producer
    logger      logger.Logger
}

func NewProcessor(
    store *store.PostgresStore,
    datasourceClient *datasource.Client,
    producer *queue.Producer,
    logger logger.Logger,
) *Processor {
    return &Processor{
        store:      store,
        datasource: datasourceClient,
        producer:   producer,
        logger:     logger,
    }
}

// ProcessBatch fetches recipients and fans out to individual notifications
func (p *Processor) ProcessBatch(ctx context.Context, batchID uuid.UUID) error {
    // Get batch record
    batch, err := p.store.GetBatch(ctx, batchID)
    if err != nil {
        return fmt.Errorf("failed to get batch: %w", err)
    }

    p.logger.Info().
        Str("batch_id", batchID.String()).
        Str("datasource", batch.DatasourceName).
        Msg("Processing batch")

    // Update status to fetching
    if err := p.store.UpdateBatchStatus(ctx, batchID, domain.BatchStatusFetching); err != nil {
        return err
    }

    // Get datasource configuration
    ds, err := p.store.GetDatasourceByName(ctx, batch.DatasourceName)
    if err != nil {
        p.store.UpdateBatchError(ctx, batchID, "datasource not found")
        return fmt.Errorf("datasource not found: %w", err)
    }

    // Fetch recipients
    recipients, err := p.datasource.FetchRecipientsWithPagination(
        ctx, ds, batch.EndpointName, batch.EndpointParams,
    )
    if err != nil {
        p.store.UpdateBatchError(ctx, batchID, err.Error())
        return fmt.Errorf("failed to fetch recipients: %w", err)
    }

    if len(recipients) == 0 {
        p.store.UpdateBatchStatus(ctx, batchID, domain.BatchStatusCompleted)
        return nil
    }

    p.logger.Info().
        Str("batch_id", batchID.String()).
        Int("recipients", len(recipients)).
        Msg("Fetched recipients")

    // Update batch total
    if err := p.store.UpdateBatchTotal(ctx, batchID, len(recipients)); err != nil {
        return err
    }

    // Update status to queued
    if err := p.store.UpdateBatchStatus(ctx, batchID, domain.BatchStatusQueued); err != nil {
        return err
    }

    // Fan out to individual notifications
    for _, recipient := range recipients {
        if err := p.createNotificationForRecipient(ctx, batch, recipient); err != nil {
            p.logger.Error().
                Err(err).
                Str("batch_id", batchID.String()).
                Str("recipient_id", recipient.ID).
                Msg("Failed to create notification for recipient")
            
            // Increment failed counter
            p.store.IncrementBatchFailed(ctx, batchID)
            continue
        }
    }

    // Update status to delivering
    if err := p.store.UpdateBatchStatus(ctx, batchID, domain.BatchStatusDelivering); err != nil {
        return err
    }

    return nil
}

func (p *Processor) createNotificationForRecipient(
    ctx context.Context,
    batch *domain.Batch,
    recipient datasource.Recipient,
) error {
    // Determine recipient address based on channel
    var toAddress string
    switch batch.Channel {
    case domain.ChannelEmail:
        toAddress = recipient.Email
        if toAddress == "" {
            p.store.IncrementBatchSkipped(ctx, *batch.ID)
            return nil // Skip silently
        }
    case domain.ChannelSMS:
        toAddress = recipient.Phone
        if toAddress == "" {
            p.store.IncrementBatchSkipped(ctx, *batch.ID)
            return nil
        }
    case domain.ChannelPush:
        toAddress = recipient.DeviceToken
        if toAddress == "" {
            p.store.IncrementBatchSkipped(ctx, *batch.ID)
            return nil
        }
    case domain.ChannelInApp:
        toAddress = recipient.ID
    }

    // Create notification
    notification := &domain.Notification{
        ID:            uuid.New(),
        BatchID:       batch.ID,
        RecipientID:   recipient.ID,
        RecipientName: recipient.Name,
        ToAddress:     toAddress,
        Channel:       batch.Channel,
        TemplateName:  batch.TemplateName,
        TemplateData:  batch.TemplateData,
        Priority:      batch.Priority,
        Status:        domain.StatusQueued,
        MaxAttempts:   3,
        CreatedAt:     time.Now(),
        UpdatedAt:     time.Now(),
    }

    // Render template if specified
    if batch.TemplateName != "" {
        template, err := p.store.GetTemplateByName(ctx, batch.TemplateName)
        if err != nil {
            return err
        }

        // Merge recipient data with template data
        mergedData := make(map[string]interface{})
        for k, v := range batch.TemplateData {
            mergedData[k] = v
        }
        mergedData["recipient_name"] = recipient.Name
        mergedData["recipient_email"] = recipient.Email

        notification.Subject = renderTemplate(template.Subject, mergedData)
        notification.Body = renderTemplate(template.Body, mergedData)
        notification.TemplateData = mergedData
    }

    // Save notification
    if err := p.store.CreateNotification(ctx, notification); err != nil {
        return err
    }

    // Enqueue for delivery
    if err := p.producer.EnqueueNotification(ctx, notification); err != nil {
        return err
    }

    return nil
}

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

## 9.4 Batch API Handler

```go
// internal/api/batch.go
package api

import (
    "github.com/gofiber/fiber/v2"
    "github.com/google/uuid"
    "buzz-service/internal/domain"
    "buzz-service/internal/queue"
    "buzz-service/internal/store"
)

type BatchHandler struct {
    store    *store.PostgresStore
    producer *queue.Producer
}

func NewBatchHandler(store *store.PostgresStore, producer *queue.Producer) *BatchHandler {
    return &BatchHandler{
        store:    store,
        producer: producer,
    }
}

// SendBulk handles POST /api/v1/notifications/bulk
func (h *BatchHandler) SendBulk(c *fiber.Ctx) error {
    var req struct {
        Datasource      string                 `json:"datasource"`
        Endpoint        string                 `json:"endpoint"`
        Params          map[string]interface{} `json:"params"`
        Channel         domain.Channel         `json:"channel"`
        Priority        domain.Priority        `json:"priority"`
        Template        string                 `json:"template"`
        Data            map[string]interface{} `json:"data"`
        IdempotencyKey  string                 `json:"idempotency_key"`
    }

    if err := c.BodyParser(&req); err != nil {
        return c.Status(400).JSON(fiber.Map{
            "error": "invalid request body",
        })
    }

    // Validation
    if req.Datasource == "" || req.Endpoint == "" {
        return c.Status(400).JSON(fiber.Map{
            "error": "datasource and endpoint are required",
        })
    }

    ctx := c.Context()

    // Check idempotency
    if req.IdempotencyKey != "" {
        existing, err := h.store.GetBatchByIdempotencyKey(ctx, req.IdempotencyKey)
        if err == nil {
            return c.Status(200).JSON(fiber.Map{
                "batch_id": existing.ID,
                "status":   existing.Status,
                "message":  "batch already exists (idempotency)",
            })
        }
    }

    // Verify datasource exists
    ds, err := h.store.GetDatasourceByName(ctx, req.Datasource)
    if err != nil {
        return c.Status(404).JSON(fiber.Map{
            "error": "datasource not found",
        })
    }

    // Create batch record
    batch := &domain.Batch{
        ID:              uuid.New(),
        DatasourceID:    &ds.ID,
        DatasourceName:  ds.Name,
        EndpointName:    req.Endpoint,
        EndpointParams:  req.Params,
        TemplateName:    req.Template,
        Channel:         req.Channel,
        Priority:        req.Priority,
        TemplateData:    req.Data,
        Status:          domain.BatchStatusFetching,
        IdempotencyKey:  req.IdempotencyKey,
        CreatedAt:       time.Now(),
        UpdatedAt:       time.Now(),
    }

    if err := h.store.CreateBatch(ctx, batch); err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "failed to create batch",
        })
    }

    // Enqueue batch processing job
    if err := h.producer.EnqueueBatchProcess(ctx, batch.ID.String()); err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "failed to enqueue batch",
        })
    }

    return c.Status(202).JSON(fiber.Map{
        "batch_id": batch.ID,
        "status":   "fetching_recipients",
        "message":  "batch queued for processing",
    })
}

// GetBatchStatus handles GET /api/v1/notifications/bulk/:id
func (h *BatchHandler) GetBatchStatus(c *fiber.Ctx) error {
    idStr := c.Params("id")
    id, err := uuid.Parse(idStr)
    if err != nil {
        return c.Status(400).JSON(fiber.Map{
            "error": "invalid batch id",
        })
    }

    batch, err := h.store.GetBatch(c.Context(), id)
    if err != nil {
        return c.Status(404).JSON(fiber.Map{
            "error": "batch not found",
        })
    }

    return c.JSON(batch)
}

// ListBatches handles GET /api/v1/notifications/bulk
func (h *BatchHandler) ListBatches(c *fiber.Ctx) error {
    status := c.Query("status")
    limit := c.QueryInt("limit", 20)
    offset := c.QueryInt("offset", 0)

    batches, total, err := h.store.ListBatches(c.Context(), status, limit, offset)
    if err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "failed to fetch batches",
        })
    }

    return c.JSON(fiber.Map{
        "data":   batches,
        "total":  total,
        "limit":  limit,
        "offset": offset,
    })
}
```

---

## 9.5 Batch Repository

```go
// internal/store/batches.go
package store

func (s *PostgresStore) CreateBatch(ctx context.Context, batch *domain.Batch) error {
    query := `
        INSERT INTO batches (
            id, datasource_id, datasource_name, endpoint_name, endpoint_params,
            template_name, channel, priority, template_data,
            status, idempotency_key, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `
    
    _, err := s.db.ExecContext(ctx, query,
        batch.ID, batch.DatasourceID, batch.DatasourceName,
        batch.EndpointName, batch.EndpointParams,
        batch.TemplateName, batch.Channel, batch.Priority,
        batch.TemplateData, batch.Status, batch.IdempotencyKey,
        batch.CreatedAt,
    )
    return err
}

func (s *PostgresStore) GetBatch(ctx context.Context, id uuid.UUID) (*domain.Batch, error) {
    query := `
        SELECT id, datasource_id, datasource_name, endpoint_name, endpoint_params,
               template_name, channel, priority, template_data,
               status, total, sent, failed, skipped,
               idempotency_key, error_message,
               started_at, completed_at, created_at, updated_at
        FROM batches
        WHERE id = $1
    `
    
    var batch domain.Batch
    err := s.db.QueryRowContext(ctx, query, id).Scan(
        &batch.ID, &batch.DatasourceID, &batch.DatasourceName,
        &batch.EndpointName, &batch.EndpointParams,
        &batch.TemplateName, &batch.Channel, &batch.Priority,
        &batch.TemplateData, &batch.Status,
        &batch.Total, &batch.Sent, &batch.Failed, &batch.Skipped,
        &batch.IdempotencyKey, &batch.ErrorMessage,
        &batch.StartedAt, &batch.CompletedAt,
        &batch.CreatedAt, &batch.UpdatedAt,
    )
    
    return &batch, err
}

func (s *PostgresStore) UpdateBatchStatus(ctx context.Context, id uuid.UUID, status domain.BatchStatus) error {
    query := "UPDATE batches SET status = $2, updated_at = NOW() WHERE id = $1"
    _, err := s.db.ExecContext(ctx, query, id, status)
    return err
}

func (s *PostgresStore) UpdateBatchTotal(ctx context.Context, id uuid.UUID, total int) error {
    query := "UPDATE batches SET total = $2, updated_at = NOW() WHERE id = $1"
    _, err := s.db.ExecContext(ctx, query, id, total)
    return err
}

func (s *PostgresStore) IncrementBatchSent(ctx context.Context, id uuid.UUID) error {
    query := "UPDATE batches SET sent = sent + 1, updated_at = NOW() WHERE id = $1"
    _, err := s.db.ExecContext(ctx, query, id)
    return err
}

func (s *PostgresStore) IncrementBatchFailed(ctx context.Context, id uuid.UUID) error {
    query := "UPDATE batches SET failed = failed + 1, updated_at = NOW() WHERE id = $1"
    _, err := s.db.ExecContext(ctx, query, id)
    return err
}

func (s *PostgresStore) IncrementBatchSkipped(ctx context.Context, id uuid.UUID) error {
    query := "UPDATE batches SET skipped = skipped + 1, updated_at = NOW() WHERE id = $1"
    _, err := s.db.ExecContext(ctx, query, id)
    return err
}
```

---

## 9.6 Deliverables

✅ Datasource registration system
✅ Datasource client with pagination support
✅ Bulk notification API
✅ Batch processor with fan-out logic
✅ Batch status tracking
✅ Recipient fetching from external datasources
✅ Idempotency for bulk sends
✅ Progress monitoring

---

## Next Phase
**Phase 10**: Documentation, deployment, and production readiness
