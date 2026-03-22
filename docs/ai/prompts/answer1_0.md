# Buzz Service — Architecture & Implementation Plan

## Architecture Overview

```
┌─────────────┐     ┌──────────────────────────────────────────────┐
│  LMS Backend │────▶│            Buzz Service (v1.0.0)             │
│  (REST API)  │     │                                              │
└─────────────┘     │  ┌─────────┐   ┌──────────┐   ┌──────────┐  │
                     │  │  API    │──▶│  Queue   │──▶│ Workers  │  │
                     │  │ (ingest)│   │ (buffer) │   │ (deliver)│  │
                     │  └─────────┘   └──────────┘   └──────────┘  │
                     │                                    │         │
                     │              ┌─────────────────────┤         │
                     │              ▼         ▼           ▼         │
                     │           ┌─────┐  ┌─────┐  ┌──────────┐   │
                     │           │Email│  │ SMS │  │   Push   │   │
                     │           └─────┘  └─────┘  └──────────┘   │
                     └──────────────────────────────────────────────┘
```

### Why a queue matters at your scale

Don't process notifications synchronously in the API request. If your LMS sends 10,000 notifications at once (e.g., assignment deadline reminder), you'll choke the service. Instead:

1. **API layer** — accepts and validates the request, returns `202 Accepted` immediately
2. **Queue** — buffers notifications (Redis with BullMQ, or SQLite with a polling worker)
3. **Workers** — consume from the queue, deliver via the appropriate channel, handle retries

---

## Tech Stack Recommendation (Low Resource, High Performance)

| Component | Choice | Why |
|-----------|--------|-----|
| **Runtime** | **Go** | ~10MB memory per instance, excellent concurrency, compiles to single binary. No runtime dependency. At 60K students, Go will handle this on a 1-core 512MB VPS easily. |
| **Alternative Runtime** | **Node.js (Fastify)** | If your team knows JS/TS better. Uses more memory (~80-150MB) but still fine at your scale. |
| **Queue** | **Redis + asynq** (Go) or **BullMQ** (Node) | Lightweight, battle-tested job queues with retry, scheduling, rate limiting built in. |
| **Database** | **PostgreSQL** | Store notification logs, delivery status, templates. You likely already run this for your LMS. |
| **Alternative (minimal)** | **SQLite** | If you want zero external dependencies. Works fine for a single-instance service. |

**Recommendation: Go + Redis + PostgreSQL.** Lowest resource usage, highest throughput, single binary deployment. If your team is JS-heavy, Node.js + Fastify + BullMQ + PostgreSQL is the pragmatic choice.

---

## Channel-Specific Implementation

### Email
- Use a transactional email provider: **Amazon SES** (cheapest at scale), **Resend**, or **Postmark**
- Send via SMTP or their SDK
- Support HTML templates with variable substitution

### SMS (Sri Lanka)
For local SMS in Sri Lanka, you have these options:

| Provider | Type | Notes |
|----------|------|-------|
| **Dialog Axiata SMS Gateway** | Local telco API | Most reliable for Dialog numbers. They offer enterprise SMS APIs. |
| **Mobitel mSpace** | Local telco API | For Mobitel network. |
| **NotifyLK** | Local SMS aggregator | `notify.lk` — Sri Lankan SMS gateway with a simple REST API. Covers all networks. **Easiest option.** |
| **Twilio** | International | Works in SL but more expensive. Good fallback. |

**Recommendation:** Start with **NotifyLK** — they aggregate across Dialog, Mobitel, Hutch, and Airtel. Simple REST API:

```
POST https://app.notify.lk/api/v1/send
{
  "user_id": "...",
  "api_key": "...",
  "sender_id": "YourBrand",
  "to": "94771234567",
  "message": "Your assignment is due tomorrow."
}
```

### Push Notifications (Web + Mobile)
- **Firebase Cloud Messaging (FCM)** — covers both web and mobile (Android + iOS) with a single API
- Flow:
  1. Client app registers with FCM, gets a device token
  2. Client sends token to your LMS backend, which stores it
  3. Buzz service calls FCM with the token + payload

```
POST https://fcm.googleapis.com/v1/projects/{project}/messages:send
{
  "message": {
    "token": "device_token_here",
    "notification": {
      "title": "Assignment Due",
      "body": "Math 101 assignment is due in 24 hours"
    }
  }
}
```

For **web push** specifically, FCM handles this via the Web Push API (service workers). No separate implementation needed.

---

## Codebase Organization

```
buzz-service/
├── cmd/
│   └── server/
│       └── main.go              # Entry point
├── internal/
│   ├── api/
│   │   ├── handler.go           # HTTP handlers
│   │   ├── middleware.go         # Auth, rate limiting
│   │   └── routes.go            # Route definitions
│   ├── domain/
│   │   └── notification.go      # Core types: Notification, Channel, Status
│   ├── queue/
│   │   ├── producer.go          # Enqueue notifications
│   │   └── consumer.go          # Process notifications
│   ├── provider/
│   │   ├── provider.go          # Provider interface
│   │   ├── email/
│   │   │   └── ses.go           # or smtp.go, resend.go
│   │   ├── sms/
│   │   │   └── notifylk.go      # Sri Lanka SMS
│   │   └── push/
│   │       └── fcm.go           # Firebase push
│   ├── store/
│   │   └── postgres.go          # DB operations (notification log)
│   └── config/
│       └── config.go            # Environment config
├── migrations/                   # SQL migrations
├── docs/
│   └── openapi.yaml             # API spec (OpenAPI 3.0)
├── Dockerfile
├── docker-compose.yml
├── Makefile
└── README.md
```

Key principles:
- **`provider` interface** — every channel implements the same interface (`Send(ctx, notification) error`). Adding a new channel = adding a new provider, zero changes elsewhere.
- **`internal/`** — Go convention that prevents external imports. Keeps your API surface clean.
- **Separation of ingestion and delivery** — the API handler never calls a provider directly. It always goes through the queue.

---

## Performance Decisions

1. **Rate limiting per provider** — SMS gateways and email providers have rate limits. Build this into your worker (e.g., 10 SMS/sec for NotifyLK).

2. **Batch where possible** — FCM supports sending to up to 500 tokens in one request. Use it.

3. **Retry with exponential backoff** — Provider down? Retry at 1s, 2s, 4s, 8s... with a max of 3-5 attempts. Dead-letter queue for permanent failures.

4. **Priority levels** — Not all notifications are equal. OTP/password reset = high priority (skip queue, process immediately). "New course available" = low priority (batch and send during off-peak).

5. **Deduplication** — Prevent sending the same notification twice. Use an idempotency key from the caller.

6. **Connection pooling** — Reuse HTTP connections to providers and DB connections.

---

## API Design (v1.0.0)

```yaml
POST /api/v1/notifications
Authorization: Bearer <api-key>

{
  "to": "student@example.com",        # or phone number, or device token
  "channel": "email",                  # email | sms | push
  "priority": "normal",               # high | normal | low
  "template": "assignment_reminder",   # template ID
  "data": {                            # template variables
    "student_name": "Kamal",
    "assignment": "Math 101 HW3",
    "due_date": "2026-03-25"
  },
  "idempotency_key": "lms-hw3-kamal-reminder-1"
}

Response: 202 Accepted
{
  "id": "notif_abc123",
  "status": "queued"
}
```

```yaml
GET /api/v1/notifications/{id}    # Check delivery status
GET /api/v1/health                # Health check
```

---

## Documentation

For other developers to integrate:

1. **OpenAPI 3.0 spec** (`docs/openapi.yaml`) — this is the standard. Tools like Swagger UI auto-generate interactive docs from it.
2. **README.md** — setup instructions, environment variables, how to run locally
3. **`docs/` folder** — architecture decision records (ADRs) for key choices

Don't over-document. The OpenAPI spec + a clear README is enough for v1.0.0.

---

## Build Order (suggested)

1. Project scaffold + config loading + health endpoint
2. PostgreSQL schema + notification storage
3. REST API (accept notification, validate, store)
4. Redis queue + worker loop
5. Email provider (easiest to test)
6. SMS provider (NotifyLK)
7. Push provider (FCM)
8. Template system
9. Retry logic + dead-letter queue
10. API key authentication
