# Project Memory — Buzz Notification Service

> This file is the persistent memory for the project. It tracks context, decisions, and state across coding sessions.
> **RULE: After ANY code change, feature implementation, bug fix, or refactoring, update this file.**

---

## Project Overview

- **Name:** Buzz Notification Service
- **Version:** v1.0.0
- **Description:** A unified notification delivery platform supporting email, SMS, push, and in-app messaging.
- **Backend:** Go 1.21+ with Fiber v2
- **Database:** PostgreSQL 15
- **Queue:** Redis + Asynq
- **Real-time:** SSE via Redis Pub/Sub
- **Frontend:** Next.js 15 (client/)

---

## Key Architecture Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Provider credentials stored in DB (not .env) | Allows dynamic provider management via API | 2024 |
| Asynq for background job processing | Reliable queue with Redis backend | 2024 |
| SSE for real-time updates | Simpler than WebSockets for server-push use case | 2024 |

---

## Current State

### Completed Features
- [x] Email delivery (SES, SMTP)
- [x] SMS delivery (Twilio, NotifyLK)
- [x] Push notifications (FCM)
- [x] In-app notifications (database-backed)
- [x] Provider CRUD API
- [x] Template CRUD API
- [x] Batch notification processing
- [x] External data source integration
- [x] SSE real-time stream
- [x] Device token registration
- [x] API key authentication
- [x] Swagger documentation
- [x] Next.js client dashboard
- [x] Role-Based Access Control (RBAC) and application workspaces
- [x] System-wide user administration

### In Progress
- [ ] *(none)*

### Planned / Backlog
- [ ] *(add items as they are planned)*

---

## Recent Changes

| Date | Change | Files Modified | Notes |
|------|--------|----------------|-------|
| 2026-05-07 | Agent workflow initialized | `agent/`, `AGENT.md` | Created memory-driven agent workflow |
| 2026-05-20 | RBAC and Workspace Members | `api/*`, `client/*` | Disabled public signup, added global endpoints exception in AuthMiddleware, added system owner role bypass, created User management UI, documented roles in README, added Copy Key option in Settings, reduced login card border radius, and updated developer docs page. |
| 2026-05-20 | Cascade Delete Fix & Switcher UI | `internal/api/users.go`, `internal/store/users_and_applications.go`, `client/src/components/Sidebar.tsx`, `client/src/app/page.tsx` | Added application ownership transfer to the deleting admin inside DeleteUser, added Create Workspace button to Sidebar for empty workspaces, and added a warning banner to Dashboard when no active workspace is selected. |
| 2026-05-20 | SMTP Email Content-Type Fix | `internal/provider/email/smtp.go` | Moved Content-Type and boundary configuration before building headers list to prevent raw multipart MIME layout display in email clients. |
| 2026-05-20 | HTML Email Auto-Detection | `internal/provider/email/types.go` | Added auto-detection for HTML content to prevent the template rendering engine from escaping HTML tags (like '<' to '&lt;') if the body is already HTML. |
| 2026-05-20 | Dashboard Charts & UI cleanups | `client/src/app/page.tsx`, `client/src/components/DashboardCharts.tsx` | Removed the bottom Quick Links section from the dashboard, added a new Recharts-powered DashboardCharts component with a Delivery Status Donut Chart and Channel Stacked Bar Chart. |
| 2026-05-20 | SSE Real-time Auth Fix | `internal/api/middleware.go`, `client/src/hooks/useSSE.ts` | Added path prefix matching for `/api/v1/stream` in isGlobalRoute to bypass session application-ID requirements for JWT, allowed user_id overrides from query parameters, and fell back to JWT in frontend hook. |
| 2026-05-20 | SSE EventSource CORS Fix | `client/src/hooks/useSSE.ts` | Removed `withCredentials: true` option from `EventSource` initialization to allow wildcard origin sharing config of backend and stop infinite reconnection loops. |
| 2026-05-20 | Settings User ID Auto-Sync | `client/src/app/settings/page.tsx` | Added auto-sync to set the User ID field to the logged-in user profile's UUID on load, and added a "Reset to my User ID" button if the developer modifies it. |
| 2026-05-20 | InApp Provider FK Fix | `internal/provider/inapp/provider.go` | Fixed missing `ApplicationID` assignment when building the `InboxEntry` — it was left as `uuid.Nil` causing a FK constraint violation on `inbox.application_id_fkey`. Now propagates `n.ApplicationID` from the notification. |

---

## Active Context

### Working On
*(Describe what is currently being worked on, if anything)*

### Open Questions / TODOs
*(List unresolved decisions or pending tasks)*

---

## File Checksums Reference

See `agent/checksums.json` for file integrity tracking.
Use checksums to detect what changed between sessions.

---

## Agent Workflow Rules

1. **After every code change**, update this memory file:
   - Add entry to "Recent Changes" table
   - Update "Current State" if features are completed or started
   - Update "Active Context" if working on something new

2. **Before starting work**, read this file to understand project context.

3. **When creating a design**, save it to `agent/designs/` and reference it here.

4. **When a session ends**, ensure this file reflects the latest state.

---

*Last updated: 2026-05-20*
