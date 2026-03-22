# Bulk Notification Architecture

## Overview

```
┌──────────────┐                    ┌─────────────────────────┐
│  Admin Panel  │                    │     Buzz Service        │
│              │                    │                         │
│  "Send to    │  POST /v1/bulk     │  1. Receive request     │
│   Group A"   │───────────────────▶│  2. Call registered      │
│              │                    │     data source endpoint │
└──────────────┘                    │  3. Get user list        │
                                    │  4. Fan out to queue     │
                                    │  5. Workers deliver      │
                                    └────────┬────────────────┘
                                             │
                                             │ GET /api/groups/{id}/members
                                             ▼
                                    ┌─────────────────────────┐
                                    │   Main Backend (LMS)    │
                                    │   "Data Source"          │
                                    │                         │
                                    │   Returns:              │
                                    │   [{ email, phone,      │
                                    │      device_token,      │
                                    │      name, ... }]       │
                                    └─────────────────────────┘
```

### The flow:

1. **Main backend registers itself** as a "data source" with the notification service
2. **Admin triggers** a bulk notification (e.g., "send assignment reminder to Group A")
3. **Buzz service calls** the registered endpoint on the main backend to fetch recipients
4. **Buzz service fans out** — creates one queued job per recipient
5. **Workers deliver** each notification individually (email, SMS, push)

---

## Data Source Registration API

The main backend registers endpoints that Buzz can call to fetch recipient data:

```yaml
POST /api/v1/datasources
Authorization: Bearer <api-key>

{
  "name": "ediflix-lms",
  "base_url": "https://api.ediflix.com",
  "auth": {
    "type": "bearer",
    "token": "secret-service-token"
  },
  "endpoints": {
    "group_members": {
      "path": "/api/notifications/groups/{group_id}/members",
      "method": "GET",
      "response_format": {
        "recipients_key": "data",        # where the array lives in response
        "email_field": "email",
        "phone_field": "phone",
        "device_token_field": "device_token",
        "name_field": "full_name"
      }
    }
  }
}
```

This is the **contract** — the main backend agrees to expose endpoints in this format. Buzz doesn't care about the internal DB schema.

### What the main backend must provide

A simple endpoint that returns recipients in a standard shape:

```json
GET /api/notifications/groups/cs101-students/members

{
  "data": [
    {
      "id": "user_001",
      "full_name": "Kamal Perera",
      "email": "kamal@example.com",
      "phone": "94771234567",
      "device_token": "fcm_token_abc"
    },
    {
      "id": "user_002",
      "full_name": "Nimali Silva",
      "email": "nimali@example.com",
      "phone": "94761234567",
      "device_token": null
    }
  ],
  "total": 2
}
```

---

## Bulk Send API

```yaml
POST /api/v1/notifications/bulk
Authorization: Bearer <api-key>

{
  "datasource": "ediflix-lms",
  "endpoint": "group_members",
  "params": {
    "group_id": "cs101-students"
  },
  "channel": "email",                    # email | sms | push | all
  "priority": "normal",
  "template": "assignment_reminder",
  "data": {
    "assignment": "Math 101 HW3",
    "due_date": "2026-03-25"
  },
  "idempotency_key": "hw3-reminder-cs101-batch-1"
}

Response: 202 Accepted
{
  "batch_id": "batch_xyz789",
  "status": "fetching_recipients",
  "estimated_recipients": null           # filled after fetch
}
```

### Batch status tracking

```yaml
GET /api/v1/notifications/bulk/{batch_id}

{
  "batch_id": "batch_xyz789",
  "status": "delivering",              # fetching | queued | delivering | completed | failed
  "total": 150,
  "sent": 98,
  "failed": 2,
  "pending": 50,
  "created_at": "2026-03-22T10:00:00Z"
}
```

---

## Internal Processing Flow

```
1. API receives bulk request
       │
2. Fetch recipients from registered data source
       │  (paginated — GET ...?page=1&per_page=100)
       │
3. Create a `batch` record in Buzz DB
       │
4. For each recipient:
       │  - Create `notification` record (status: queued)
       │  - Push job to Redis queue
       │
5. Workers pick up jobs
       │  - Deliver via provider (email/sms/push)
       │  - Update notification status (sent/failed)
       │  - Update batch counters
       │
6. When all jobs done → batch status = "completed"
```

### Key details:

- **Pagination** — if a group has 10,000 students, fetch in pages of 100. Don't load all into memory at once.
- **Fan-out is async** — the API returns immediately. Fan-out happens in a background worker.
- **Per-recipient records** — every student gets their own notification row in the Buzz DB. This lets you track delivery per user and retry individually.
- **Skip missing channels** — if `channel: "sms"` but a user has no phone number, mark as `skipped`, don't fail the batch.

---

## Buzz Service DB Schema (notification-related only)

```sql
-- Registered data sources
CREATE TABLE datasources (
    id          UUID PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    base_url    TEXT NOT NULL,
    auth_config JSONB NOT NULL,
    endpoints   JSONB NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Bulk send batches
CREATE TABLE batches (
    id              UUID PRIMARY KEY,
    datasource_id   UUID REFERENCES datasources(id),
    template        VARCHAR(100) NOT NULL,
    channel         VARCHAR(20) NOT NULL,
    template_data   JSONB,
    total           INT DEFAULT 0,
    sent            INT DEFAULT 0,
    failed          INT DEFAULT 0,
    skipped         INT DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'fetching',
    idempotency_key VARCHAR(255) UNIQUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Individual notifications (both single + bulk)
CREATE TABLE notifications (
    id              UUID PRIMARY KEY,
    batch_id        UUID REFERENCES batches(id),  -- NULL for single sends
    recipient_id    VARCHAR(100),                  -- external user ID
    channel         VARCHAR(20) NOT NULL,
    to_address      TEXT NOT NULL,                 -- email/phone/token
    template        VARCHAR(100),
    template_data   JSONB,
    status          VARCHAR(20) DEFAULT 'queued',  -- queued/sent/failed/skipped
    attempts        INT DEFAULT 0,
    last_error      TEXT,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_batch ON notifications(batch_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_batches_idempotency ON batches(idempotency_key);
```

---

## Updated Codebase Addition

```
internal/
├── datasource/
│   ├── registry.go          # CRUD for data sources
│   └── fetcher.go           # Call registered endpoints, paginate, normalize
├── batch/
│   ├── handler.go           # Bulk send API handler
│   ├── processor.go         # Fan-out: fetch recipients → enqueue per-user jobs
│   └── tracker.go           # Batch status updates
```
