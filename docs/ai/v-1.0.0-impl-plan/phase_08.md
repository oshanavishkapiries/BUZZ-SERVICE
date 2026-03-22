# Phase 08: Real-Time In-App Notifications (SSE)

## Objectives
- Implement Server-Sent Events (SSE) gateway
- Create in-app notification provider
- Add Redis Pub/Sub for multi-instance support
- Implement inbox API for notification history
- Add read/unread tracking
- Create connection management system

---

## 8.1 In-App Provider

```go
// internal/provider/inapp/provider.go
package inapp

import (
    "context"
    "encoding/json"
    "fmt"

    "github.com/redis/go-redis/v9"
    "buzz-service/internal/domain"
    "buzz-service/internal/store"
)

type InAppProvider struct {
    store       *store.PostgresStore
    redisClient *redis.Client
}

func NewInAppProvider(store *store.PostgresStore, redisClient *redis.Client) *InAppProvider {
    return &InAppProvider{
        store:       store,
        redisClient: redisClient,
    }
}

func (p *InAppProvider) Send(ctx context.Context, n *domain.Notification) error {
    // 1. Create inbox entry
    inboxEntry := &domain.InboxEntry{
        ID:             uuid.New(),
        NotificationID: n.ID,
        UserID:         n.RecipientID,
        Title:          n.Subject,
        Body:           n.Body,
        Metadata:       n.TemplateData,
        Read:           false,
        CreatedAt:      time.Now(),
    }

    if err := p.store.CreateInboxEntry(ctx, inboxEntry); err != nil {
        return fmt.Errorf("failed to create inbox entry: %w", err)
    }

    // 2. Publish to Redis Pub/Sub for real-time delivery
    channel := fmt.Sprintf("user:%s", n.RecipientID)
    payload := map[string]interface{}{
        "id":         inboxEntry.ID,
        "title":      inboxEntry.Title,
        "body":       inboxEntry.Body,
        "metadata":   inboxEntry.Metadata,
        "read":       false,
        "created_at": inboxEntry.CreatedAt,
    }

    jsonPayload, err := json.Marshal(payload)
    if err != nil {
        return fmt.Errorf("failed to marshal payload: %w", err)
    }

    if err := p.redisClient.Publish(ctx, channel, jsonPayload).Err(); err != nil {
        return fmt.Errorf("failed to publish to Redis: %w", err)
    }

    return nil
}

func (p *InAppProvider) Name() string {
    return "in-app"
}

func (p *InAppProvider) SupportsChannel(channel domain.Channel) bool {
    return channel == domain.ChannelInApp
}
```

---

## 8.2 SSE Gateway

```go
// internal/realtime/gateway.go
package realtime

import (
    "context"
    "encoding/json"
    "fmt"
    "sync"
    "time"

    "github.com/gofiber/fiber/v2"
    "github.com/redis/go-redis/v9"
    "buzz-service/pkg/logger"
)

type Gateway struct {
    connections *ConnectionManager
    pubsub      *redis.PubSub
    redis       *redis.Client
    logger      logger.Logger
    ctx         context.Context
    cancel      context.CancelFunc
}

func NewGateway(redisClient *redis.Client, logger logger.Logger) *Gateway {
    ctx, cancel := context.WithCancel(context.Background())
    
    return &Gateway{
        connections: NewConnectionManager(),
        redis:       redisClient,
        logger:      logger,
        ctx:         ctx,
        cancel:      cancel,
    }
}

func (g *Gateway) Start() {
    go g.subscribeToPubSub()
    g.logger.Info().Msg("SSE gateway started")
}

func (g *Gateway) Stop() {
    g.cancel()
    if g.pubsub != nil {
        g.pubsub.Close()
    }
    g.connections.CloseAll()
    g.logger.Info().Msg("SSE gateway stopped")
}

// HandleSSEConnection handles SSE client connections
func (g *Gateway) HandleSSEConnection(c *fiber.Ctx) error {
    // Get user ID from context (set by auth middleware)
    userID := c.Locals("user_id").(string)
    if userID == "" {
        return c.Status(401).SendString("Unauthorized")
    }

    // Set SSE headers
    c.Set("Content-Type", "text/event-stream")
    c.Set("Cache-Control", "no-cache")
    c.Set("Connection", "keep-alive")
    c.Set("X-Accel-Buffering", "no") // Disable nginx buffering

    c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
        conn := NewSSEConnection(userID, w, g.logger)
        
        // Register connection
        g.connections.Add(userID, conn)
        defer g.connections.Remove(userID, conn.ID)

        g.logger.Info().
            Str("user_id", userID).
            Str("conn_id", conn.ID).
            Msg("SSE client connected")

        // Send initial connection event
        conn.Send("connected", map[string]interface{}{
            "status": "connected",
            "time":   time.Now(),
        })

        // Keep connection alive with heartbeats
        ticker := time.NewTicker(30 * time.Second)
        defer ticker.Stop()

        for {
            select {
            case <-ticker.C:
                // Send heartbeat
                if err := conn.Ping(); err != nil {
                    g.logger.Debug().
                        Str("user_id", userID).
                        Err(err).
                        Msg("Heartbeat failed, closing connection")
                    return
                }

            case <-conn.Done():
                g.logger.Info().
                    Str("user_id", userID).
                    Str("conn_id", conn.ID).
                    Msg("SSE client disconnected")
                return

            case <-c.Context().Done():
                return
            }
        }
    })

    return nil
}

// subscribeToPubSub subscribes to all user channels and broadcasts messages
func (g *Gateway) subscribeToPubSub() {
    // Subscribe to pattern for all user channels
    g.pubsub = g.redis.PSubscribe(g.ctx, "user:*")
    
    ch := g.pubsub.Channel()

    for {
        select {
        case msg := <-ch:
            // Extract user ID from channel name (user:123 -> 123)
            userID := msg.Channel[5:] // Remove "user:" prefix

            // Get all connections for this user
            connections := g.connections.GetUserConnections(userID)
            if len(connections) == 0 {
                continue
            }

            // Parse payload
            var payload map[string]interface{}
            if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
                g.logger.Error().Err(err).Msg("Failed to parse pub/sub message")
                continue
            }

            // Broadcast to all user connections
            for _, conn := range connections {
                if err := conn.Send("notification", payload); err != nil {
                    g.logger.Error().
                        Str("user_id", userID).
                        Str("conn_id", conn.ID).
                        Err(err).
                        Msg("Failed to send notification to client")
                }
            }

        case <-g.ctx.Done():
            return
        }
    }
}
```

---

## 8.3 SSE Connection Management

```go
// internal/realtime/connection.go
package realtime

import (
    "bufio"
    "fmt"
    "sync"
    "time"

    "github.com/google/uuid"
    "buzz-service/pkg/logger"
)

type SSEConnection struct {
    ID       string
    UserID   string
    writer   *bufio.Writer
    done     chan struct{}
    mu       sync.Mutex
    logger   logger.Logger
}

func NewSSEConnection(userID string, writer *bufio.Writer, logger logger.Logger) *SSEConnection {
    return &SSEConnection{
        ID:     uuid.New().String(),
        UserID: userID,
        writer: writer,
        done:   make(chan struct{}),
        logger: logger,
    }
}

func (c *SSEConnection) Send(event string, data interface{}) error {
    c.mu.Lock()
    defer c.mu.Unlock()

    // Format: event: <event>\ndata: <json>\n\n
    if _, err := fmt.Fprintf(c.writer, "event: %s\n", event); err != nil {
        return err
    }

    jsonData, err := json.Marshal(data)
    if err != nil {
        return err
    }

    if _, err := fmt.Fprintf(c.writer, "data: %s\n\n", jsonData); err != nil {
        return err
    }

    return c.writer.Flush()
}

func (c *SSEConnection) Ping() error {
    c.mu.Lock()
    defer c.mu.Unlock()

    // SSE comment for keep-alive
    if _, err := c.writer.WriteString(": ping\n\n"); err != nil {
        return err
    }

    return c.writer.Flush()
}

func (c *SSEConnection) Close() {
    select {
    case <-c.done:
        // Already closed
    default:
        close(c.done)
    }
}

func (c *SSEConnection) Done() <-chan struct{} {
    return c.done
}

// ConnectionManager manages multiple SSE connections
type ConnectionManager struct {
    connections map[string][]*SSEConnection // userID -> connections
    mu          sync.RWMutex
}

func NewConnectionManager() *ConnectionManager {
    return &ConnectionManager{
        connections: make(map[string][]*SSEConnection),
    }
}

func (m *ConnectionManager) Add(userID string, conn *SSEConnection) {
    m.mu.Lock()
    defer m.mu.Unlock()

    m.connections[userID] = append(m.connections[userID], conn)
}

func (m *ConnectionManager) Remove(userID string, connID string) {
    m.mu.Lock()
    defer m.mu.Unlock()

    connections := m.connections[userID]
    for i, conn := range connections {
        if conn.ID == connID {
            conn.Close()
            m.connections[userID] = append(connections[:i], connections[i+1:]...)
            break
        }
    }

    // Clean up empty user entries
    if len(m.connections[userID]) == 0 {
        delete(m.connections, userID)
    }
}

func (m *ConnectionManager) GetUserConnections(userID string) []*SSEConnection {
    m.mu.RLock()
    defer m.mu.RUnlock()

    return m.connections[userID]
}

func (m *ConnectionManager) CloseAll() {
    m.mu.Lock()
    defer m.mu.Unlock()

    for _, connections := range m.connections {
        for _, conn := range connections {
            conn.Close()
        }
    }
    
    m.connections = make(map[string][]*SSEConnection)
}

func (m *ConnectionManager) GetStats() map[string]int {
    m.mu.RLock()
    defer m.mu.RUnlock()

    stats := make(map[string]int)
    totalConnections := 0

    for _, connections := range m.connections {
        totalConnections += len(connections)
    }

    stats["total_users"] = len(m.connections)
    stats["total_connections"] = totalConnections

    return stats
}
```

---

## 8.4 Inbox API

```go
// internal/api/inbox.go
package api

import (
    "github.com/gofiber/fiber/v2"
    "github.com/google/uuid"
    "buzz-service/internal/store"
)

type InboxHandler struct {
    store *store.PostgresStore
}

func NewInboxHandler(store *store.PostgresStore) *InboxHandler {
    return &InboxHandler{store: store}
}

// GetInbox handles GET /api/v1/inbox
func (h *InboxHandler) GetInbox(c *fiber.Ctx) error {
    userID := c.Locals("user_id").(string)
    
    unreadOnly := c.QueryBool("unread", false)
    limit := c.QueryInt("limit", 20)
    offset := c.QueryInt("offset", 0)

    filters := store.InboxFilters{
        UserID:     userID,
        UnreadOnly: unreadOnly,
        Limit:      limit,
        Offset:     offset,
    }

    entries, total, err := h.store.GetInbox(c.Context(), filters)
    if err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "failed to fetch inbox",
        })
    }

    unreadCount, err := h.store.GetUnreadCount(c.Context(), userID)
    if err != nil {
        unreadCount = 0
    }

    return c.JSON(fiber.Map{
        "data":         entries,
        "total":        total,
        "unread_count": unreadCount,
        "limit":        limit,
        "offset":       offset,
    })
}

// MarkAsRead handles PATCH /api/v1/inbox/:id/read
func (h *InboxHandler) MarkAsRead(c *fiber.Ctx) error {
    userID := c.Locals("user_id").(string)
    
    idStr := c.Params("id")
    id, err := uuid.Parse(idStr)
    if err != nil {
        return c.Status(400).JSON(fiber.Map{
            "error": "invalid inbox entry id",
        })
    }

    if err := h.store.MarkInboxAsRead(c.Context(), id, userID); err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "failed to mark as read",
        })
    }

    return c.JSON(fiber.Map{
        "message": "marked as read",
    })
}

// MarkAllAsRead handles POST /api/v1/inbox/read-all
func (h *InboxHandler) MarkAllAsRead(c *fiber.Ctx) error {
    userID := c.Locals("user_id").(string)

    count, err := h.store.MarkAllInboxAsRead(c.Context(), userID)
    if err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "failed to mark all as read",
        })
    }

    return c.JSON(fiber.Map{
        "message": fmt.Sprintf("marked %d notifications as read", count),
        "count":   count,
    })
}

// DeleteNotification handles DELETE /api/v1/inbox/:id
func (h *InboxHandler) DeleteNotification(c *fiber.Ctx) error {
    userID := c.Locals("user_id").(string)
    
    idStr := c.Params("id")
    id, err := uuid.Parse(idStr)
    if err != nil {
        return c.Status(400).JSON(fiber.Map{
            "error": "invalid inbox entry id",
        })
    }

    if err := h.store.DeleteInboxEntry(c.Context(), id, userID); err != nil {
        return c.Status(500).JSON(fiber.Map{
            "error": "failed to delete notification",
        })
    }

    return c.JSON(fiber.Map{
        "message": "notification deleted",
    })
}
```

---

## 8.5 Inbox Repository

```go
// internal/store/inbox.go
package store

import (
    "context"
    "database/sql"
    "buzz-service/internal/domain"
)

type InboxFilters struct {
    UserID     string
    UnreadOnly bool
    Limit      int
    Offset     int
}

func (s *PostgresStore) CreateInboxEntry(ctx context.Context, entry *domain.InboxEntry) error {
    query := `
        INSERT INTO inbox (id, notification_id, user_id, title, body, metadata, read, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `
    
    _, err := s.db.ExecContext(ctx, query,
        entry.ID, entry.NotificationID, entry.UserID,
        entry.Title, entry.Body, entry.Metadata,
        entry.Read, entry.CreatedAt,
    )
    return err
}

func (s *PostgresStore) GetInbox(ctx context.Context, filters InboxFilters) ([]domain.InboxEntry, int, error) {
    // Build query
    query := `
        SELECT id, notification_id, user_id, title, body, metadata,
               read, read_at, archived, archived_at, created_at
        FROM inbox
        WHERE user_id = $1
    `
    
    args := []interface{}{filters.UserID}
    argCount := 1

    if filters.UnreadOnly {
        argCount++
        query += fmt.Sprintf(" AND read = false")
    }

    query += " ORDER BY created_at DESC"
    
    argCount++
    query += fmt.Sprintf(" LIMIT $%d", argCount)
    args = append(args, filters.Limit)
    
    argCount++
    query += fmt.Sprintf(" OFFSET $%d", argCount)
    args = append(args, filters.Offset)

    // Execute query
    rows, err := s.db.QueryContext(ctx, query, args...)
    if err != nil {
        return nil, 0, err
    }
    defer rows.Close()

    var entries []domain.InboxEntry
    for rows.Next() {
        var entry domain.InboxEntry
        err := rows.Scan(
            &entry.ID, &entry.NotificationID, &entry.UserID,
            &entry.Title, &entry.Body, &entry.Metadata,
            &entry.Read, &entry.ReadAt, &entry.Archived,
            &entry.ArchivedAt, &entry.CreatedAt,
        )
        if err != nil {
            return nil, 0, err
        }
        entries = append(entries, entry)
    }

    // Get total count
    countQuery := "SELECT COUNT(*) FROM inbox WHERE user_id = $1"
    if filters.UnreadOnly {
        countQuery += " AND read = false"
    }
    
    var total int
    err = s.db.QueryRowContext(ctx, countQuery, filters.UserID).Scan(&total)
    if err != nil {
        return entries, 0, err
    }

    return entries, total, nil
}

func (s *PostgresStore) GetUnreadCount(ctx context.Context, userID string) (int, error) {
    query := "SELECT COUNT(*) FROM inbox WHERE user_id = $1 AND read = false"
    
    var count int
    err := s.db.QueryRowContext(ctx, query, userID).Scan(&count)
    return count, err
}

func (s *PostgresStore) MarkInboxAsRead(ctx context.Context, id uuid.UUID, userID string) error {
    query := `
        UPDATE inbox
        SET read = true, read_at = NOW()
        WHERE id = $1 AND user_id = $2
    `
    
    _, err := s.db.ExecContext(ctx, query, id, userID)
    return err
}

func (s *PostgresStore) MarkAllInboxAsRead(ctx context.Context, userID string) (int, error) {
    query := `
        UPDATE inbox
        SET read = true, read_at = NOW()
        WHERE user_id = $1 AND read = false
    `
    
    result, err := s.db.ExecContext(ctx, query, userID)
    if err != nil {
        return 0, err
    }

    count, err := result.RowsAffected()
    return int(count), err
}

func (s *PostgresStore) DeleteInboxEntry(ctx context.Context, id uuid.UUID, userID string) error {
    query := "DELETE FROM inbox WHERE id = $1 AND user_id = $2"
    _, err := s.db.ExecContext(ctx, query, id, userID)
    return err
}
```

---

## 8.6 User Authentication for SSE

```go
// internal/api/middleware.go (additions)

func SSEAuthMiddleware(store APIKeyStore) fiber.Handler {
    return func(c *fiber.Ctx) error {
        // SSE doesn't support custom headers in browser EventSource
        // So we accept token as query parameter or via cookie
        
        token := c.Query("token")
        if token == "" {
            // Try cookie
            token = c.Cookies("auth_token")
        }

        if token == "" {
            return c.Status(401).SendString("Unauthorized: missing token")
        }

        // Validate JWT token and extract user_id
        // (Implementation depends on your auth system)
        userID, err := validateUserToken(token)
        if err != nil {
            return c.Status(401).SendString("Unauthorized: invalid token")
        }

        // Store user_id in context
        c.Locals("user_id", userID)
        
        return c.Next()
    }
}
```

---

## 8.7 Updated Routes

```go
// internal/api/routes.go (additions)

func SetupRoutes(
    app *fiber.App,
    db *store.PostgresStore,
    producer *queue.Producer,
    gateway *realtime.Gateway,
) {
    // ... existing routes ...

    // SSE endpoint (user auth required)
    app.Get("/api/v1/stream", SSEAuthMiddleware(db), gateway.HandleSSEConnection)

    // Inbox endpoints (user auth required)
    inboxHandler := NewInboxHandler(db)
    inbox := v1.Group("/inbox")
    inbox.Use(UserAuthMiddleware(db)) // Different from API key auth
    inbox.Get("/", inboxHandler.GetInbox)
    inbox.Patch("/:id/read", inboxHandler.MarkAsRead)
    inbox.Post("/read-all", inboxHandler.MarkAllAsRead)
    inbox.Delete("/:id", inboxHandler.DeleteNotification)
}
```

---

## 8.8 Frontend Integration Example

```javascript
// Frontend SSE client
class NotificationClient {
    constructor(apiURL, token) {
        this.apiURL = apiURL;
        this.token = token;
        this.eventSource = null;
        this.listeners = {};
    }

    connect() {
        this.eventSource = new EventSource(
            `${this.apiURL}/api/v1/stream?token=${this.token}`
        );

        this.eventSource.addEventListener('connected', (event) => {
            const data = JSON.parse(event.data);
            console.log('Connected to notification service', data);
        });

        this.eventSource.addEventListener('notification', (event) => {
            const notification = JSON.parse(event.data);
            this.handleNotification(notification);
        });

        this.eventSource.onerror = (error) => {
            console.error('SSE error:', error);
            // Auto-reconnects by default
        };
    }

    handleNotification(notification) {
        // Show toast notification
        this.showToast(notification.title, notification.body);
        
        // Update unread badge
        this.incrementBadge();
        
        // Call registered listeners
        if (this.listeners['notification']) {
            this.listeners['notification'].forEach(fn => fn(notification));
        }
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
        }
    }

    showToast(title, body) {
        // Implementation depends on your UI library
        console.log(`[${title}] ${body}`);
    }

    incrementBadge() {
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            const count = parseInt(badge.textContent) || 0;
            badge.textContent = count + 1;
            badge.style.display = 'block';
        }
    }
}

// Usage
const client = new NotificationClient('http://localhost:8080', userToken);
client.connect();

client.on('notification', (notification) => {
    console.log('Received notification:', notification);
    // Update UI, play sound, etc.
});
```

---

## 8.9 Deliverables

✅ SSE gateway implementation
✅ In-app notification provider
✅ Redis Pub/Sub for multi-instance support
✅ Connection management system
✅ Inbox API (get, mark as read, delete)
✅ Unread count tracking
✅ Frontend SSE client integration
✅ User authentication for SSE
✅ Heartbeat/keep-alive mechanism

---

## 8.10 Testing Phase 8

```bash
# Connect to SSE stream (use browser or curl)
curl -N "http://localhost:8080/api/v1/stream?token=user_jwt_token"

# In another terminal, send an in-app notification
curl -X POST http://localhost:8080/api/v1/notifications \
  -H "Authorization: Bearer buzz_test_key_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user_123",
    "channel": "in_app",
    "subject": "New Message",
    "body": "You have a new message from your instructor",
    "data": {
      "action_url": "/messages/456"
    }
  }'

# Should see the notification appear in SSE stream instantly

# Get inbox
curl "http://localhost:8080/api/v1/inbox?unread=true" \
  -H "Authorization: Bearer user_jwt_token"

# Mark as read
curl -X PATCH "http://localhost:8080/api/v1/inbox/{id}/read" \
  -H "Authorization: Bearer user_jwt_token"
```

---

## Next Phase
**Phase 09**: Bulk notifications + datasource integration
