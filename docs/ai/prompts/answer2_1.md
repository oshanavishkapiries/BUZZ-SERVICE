# Real-Time Platform Notifications (WebSocket / SSE)

## The Problem

Buzz currently pushes notifications _outward_ (email, SMS, FCM). But frontends also want **in-app real-time notifications** — the bell icon with a badge, toast popups, live updates without refreshing.

```
Currently:
  Buzz → Email/SMS/Push (one-way, no client connection)

What you want:
  Buzz → Connected frontend clients (real-time, bidirectional)
```

---

## Architecture: Add a Real-Time Gateway

```
┌─────────────┐    ┌──────────────────────────────────────────────────┐
│  LMS Backend │───▶│              Buzz Service                        │
└─────────────┘    │                                                   │
                    │  ┌─────────┐   ┌────────┐   ┌─────────────────┐ │
                    │  │  API    │──▶│ Queue  │──▶│    Workers      │ │
                    │  └─────────┘   └────────┘   │                 │ │
                    │                              │  ┌───────────┐ │ │
                    │                              │  │ Email     │ │ │
                    │                              │  │ SMS       │ │ │
                    │                              │  │ Push(FCM) │ │ │
                    │                              │  │ ★ Realtime│ │ │
                    │                              │  └───────────┘ │ │
                    │                              └────────┬────────┘ │
                    │  ┌────────────────────────────────────┘          │
                    │  ▼                                               │
                    │  ┌──────────────────────────────┐               │
                    │  │   Real-Time Gateway          │               │
                    │  │   (WebSocket / SSE server)   │               │
                    │  │                              │               │
                    │  │  Redis Pub/Sub ← Workers     │               │
                    │  │       │                      │               │
                    │  │       ▼                      │               │
                    │  │  Connected Clients Map       │               │
                    │  │  user_001 → [ws_conn_1]      │               │
                    │  │  user_002 → [ws_conn_2, _3]  │               │
                    │  └──────────────────────────────┘               │
                    └──────────────────────────────────────────────────┘
                                    ▲         ▲         ▲
                                    │         │         │
                              ┌─────┘    ┌────┘    ┌────┘
                              │          │         │
                           Web App   Mobile App  Admin Panel
                           (WS/SSE)  (WS/SSE)   (WS/SSE)
```

---

## WebSocket vs SSE — Which One?

|                     | WebSocket                                  | SSE (Server-Sent Events)    |
| ------------------- | ------------------------------------------ | --------------------------- |
| **Direction**       | Bidirectional                              | Server → Client only        |
| **Complexity**      | Higher (connection management, heartbeats) | Lower (just HTTP streaming) |
| **Browser support** | All modern browsers                        | All modern browsers         |
| **Mobile**          | Needs a WS library                         | HTTP-based, simpler         |
| **Reconnection**    | You build it                               | Built-in auto-reconnect     |
| **Load balancers**  | Needs sticky sessions or upgrade support   | Works with standard HTTP    |

**Recommendation: SSE for v1.0.0.** Notifications are server→client only — you don't need the client to send data back through the connection. SSE is simpler, auto-reconnects, and works through standard HTTP infrastructure. Switch to WebSocket later only if you need bidirectional features (read receipts, typing indicators, etc.).

---

## How It Works

### 1. Client connects

```javascript
// Frontend — dead simple
const eventSource = new EventSource(
  "https://buzz.elight.com/api/v1/stream?token=user-jwt-token",
);

eventSource.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  showToast(notification.title, notification.body);
  incrementBadgeCount();
};

eventSource.addEventListener("notification", (event) => {
  const data = JSON.parse(event.data);
  // { id, title, body, channel, created_at, read: false }
});
```

### 2. Buzz authenticates and registers the connection

```
Client connects with JWT → Buzz validates token → extracts user_id
→ Adds connection to in-memory map: connections[user_id] = [conn]
→ Subscribes to Redis Pub/Sub channel: "user:{user_id}"
```

### 3. When a notification is sent

```
Worker delivers email/SMS/push as usual
       │
       ├──▶ Also publishes to Redis Pub/Sub: "user:{user_id}"
       │
       ▼
Gateway receives pub/sub message
       │
       ▼
Looks up connections[user_id]
       │
       ▼
Sends SSE event to all connected clients for that user
```

### 4. Redis Pub/Sub is the glue

Why Redis Pub/Sub and not just in-memory?

- If you scale to **multiple Buzz instances** behind a load balancer, each instance only knows about its own connections
- Redis Pub/Sub broadcasts to all instances — the one holding the user's connection delivers it
- You already have Redis for the job queue, so no new infrastructure

---

## New APIs

```yaml
# SSE stream — client connects and holds open
GET /api/v1/stream
Authorization: Bearer <user-jwt>
Accept: text/event-stream

# Response (kept open):
event: notification
data: {"id":"notif_abc","title":"Assignment Due","body":"Math 101 HW3 due tomorrow","read":false,"created_at":"2026-03-22T10:00:00Z"}

event: notification
data: {"id":"notif_def","title":"New Grade Posted","body":"You scored 85% on Quiz 2","read":false,"created_at":"2026-03-22T10:05:00Z"}

# Heartbeat every 30s to keep connection alive
: ping
```

```yaml
# Fetch unread notifications (for when client first loads / reconnects)
GET /api/v1/notifications/inbox?unread=true&limit=20
Authorization: Bearer <user-jwt>

{
  "data": [
    {"id": "notif_abc", "title": "...", "body": "...", "read": false, "created_at": "..."},
    ...
  ],
  "unread_count": 5
}
```

```yaml
# Mark as read
PATCH /api/v1/notifications/{id}/read
Authorization: Bearer <user-jwt>

# Mark all as read
POST /api/v1/notifications/read-all
Authorization: Bearer <user-jwt>
```

---

## New DB Tables

```sql
-- In-app notification inbox (per-user)
CREATE TABLE inbox (
    id              UUID PRIMARY KEY,
    notification_id UUID REFERENCES notifications(id),
    user_id         VARCHAR(100) NOT NULL,       -- external user ID
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    metadata        JSONB,                        -- extra data for deep links etc.
    read            BOOLEAN DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inbox_user_unread ON inbox(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_inbox_user_created ON inbox(user_id, created_at DESC);
```

---

## New Channel: "in_app"

Real-time becomes just another channel in your provider interface:

```go
// provider/realtime/sse.go — implements the same Provider interface

func (s *SSEProvider) Send(ctx context.Context, n *domain.Notification) error {
    // 1. Store in inbox table
    s.store.CreateInboxEntry(ctx, n)

    // 2. Publish to Redis so the gateway pushes to connected clients
    s.redis.Publish(ctx, "user:"+n.RecipientID, payload)

    return nil
}
```

Now your bulk send API can do:

```json
{
  "channel": "all",  // sends email + sms + push + in_app
  ...
}
```

Or just:

```json
{
  "channel": "in_app",  // real-time only, no email/sms
  ...
}
```

---

## Codebase Addition

```
internal/
├── realtime/
│   ├── gateway.go           # SSE connection manager
│   ├── connections.go       # In-memory user→connections map (thread-safe)
│   └── pubsub.go            # Redis Pub/Sub subscriber
├── inbox/
│   ├── handler.go           # GET /inbox, PATCH /read endpoints
│   └── store.go             # Inbox DB operations
├── provider/
│   ├── realtime/
│   │   └── sse.go           # In-app channel provider
```

---

## Key Considerations

1. **Connection limits** — Each SSE connection holds an open HTTP connection. A single Go server can handle ~100K concurrent connections easily. At 60K students, you're fine on one instance even if all are online simultaneously.

2. **Missed notifications** — Client was offline when notification was sent? On reconnect, client calls `GET /inbox?unread=true` to catch up. SSE also supports `Last-Event-ID` header for automatic catch-up.

3. **Authentication** — SSE doesn't support custom headers in the browser `EventSource` API. Pass the JWT as a query parameter (`?token=...`) or use a short-lived ticket:

   ```
   POST /api/v1/stream/ticket → { "ticket": "one-time-token" }
   GET /api/v1/stream?ticket=one-time-token
   ```

4. **Mobile apps** — SSE works on mobile but drains battery if kept open. For mobile, rely on **FCM push** as the primary channel and use SSE only when the app is in the foreground.

5. **Cleanup** — Remove connections from the map when clients disconnect. Set a read timeout to detect dead connections.
