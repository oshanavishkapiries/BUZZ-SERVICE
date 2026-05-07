# Next.js Testing Client - Development Progress

## Completed ✅

### Phase 1: Scaffold
- Next.js 15 (App Router) with TypeScript, Tailwind CSS
- Package setup with SWR, Recharts, Zustand
- All production build passes

### Phase 2: Foundation
- **Types** (`src/lib/types.ts`) — 80+ TS interfaces for all API models and enums
- **API Client** (`src/lib/api.ts`) — Typed functions for 30+ endpoints with auth headers
- **Config** (`src/lib/config.ts`) — localStorage persistence for API settings
- **SSE Hook** (`src/hooks/useSSE.ts`) — Real-time event streaming with reconnect logic
- **Components**:
  - Sidebar navigation (8 pages)
  - Health status indicator
  - **Notification Matrix** — Channel × Status workload grid with auto-refresh

### Phase 3: Pages (Partial)
- **Dashboard** (`/`) — Health check, notification matrix, quick actions
- **Settings** (`/settings`) — API URL/key/user ID configuration
- **Placeholders** for: Notifications, Stream, Inbox, Templates, Devices, Batches

## In Progress 🚀

### Phase 3 Continuation (Pages to Complete)
1. **Notifications** (`/notifications`) — Send form + list/filter
2. **Stream** (`/stream`) — SSE feed viewer
3. **Inbox** (`/inbox`) — In-app message list
4. **Templates** (`/templates`) — CRUD interface
5. **Devices** (`/devices`) — Device registration/management
6. **Batches** (`/batches`) — Bulk send + progress tracking

## How to Run

```bash
# Terminal 1: Start the Go service
cd /workspaces/BUZZ-SERVICE
air -c .air.toml

# Terminal 2: Start the Next.js client
cd /workspaces/BUZZ-SERVICE/client
npm run dev

# Open in browser
open http://localhost:3000
```

**Settings** → Configure API URL (default: http://localhost:8080), API key, User ID