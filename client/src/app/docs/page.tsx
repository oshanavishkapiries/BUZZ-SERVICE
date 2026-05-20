'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen, Bell, Database, Layers, Key, Wifi,
  FileText, ChevronRight, Terminal, AlertCircle, Users,
  Cpu, Copy, Check, Globe,
} from 'lucide-react';

type Section =
  | 'overview'
  | 'quickstart'
  | 'auth'
  | 'users'
  | 'templates'
  | 'send'
  | 'inbox'
  | 'datasources'
  | 'batch'
  | 'sse'
  | 'react'
  | 'ai_prompt'
  | 'errors';

const sections: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'overview',    label: 'Overview',               icon: BookOpen  },
  { id: 'quickstart',  label: 'Quick Start',             icon: Terminal  },
  { id: 'auth',        label: 'Authentication',          icon: Key       },
  { id: 'users',       label: 'Users & Workspaces',      icon: Users     },
  { id: 'templates',   label: 'Templates',               icon: FileText  },
  { id: 'send',        label: 'Send Notifications',      icon: Bell      },
  { id: 'inbox',       label: 'Inbox (in-app)',          icon: Globe     },
  { id: 'datasources', label: 'Datasources',             icon: Database  },
  { id: 'batch',       label: 'Batch Notifications',     icon: Layers    },
  { id: 'sse',         label: 'Real-time (SSE)',         icon: Wifi      },
  { id: 'react',       label: 'React Integration',       icon: Cpu       },
  { id: 'ai_prompt',   label: 'AI Agent Prompts',        icon: Cpu       },
  { id: 'errors',      label: 'Error Reference',         icon: AlertCircle },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="absolute top-2 right-2 p-1.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      title="Copy"
    >
      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
    </button>
  );
}

function Code({ children, lang = 'json' }: { children: string; lang?: string }) {
  const trimmed = children.trim();
  return (
    <div className="relative my-3">
      <pre className={`language-${lang} text-xs font-mono bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-[var(--radius)] p-4 pr-10 overflow-x-auto whitespace-pre leading-relaxed text-[var(--text-secondary)]`}>
        {trimmed}
      </pre>
      <CopyButton text={trimmed} />
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold text-[var(--text-primary)] mt-6 mb-2 flex items-center gap-2">{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-[var(--text-primary)] mt-4 mb-1.5">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-2">{children}</p>;
}

function Field({ name, type, req, desc }: { name: string; type: string; req?: boolean; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[var(--border-color)] last:border-0">
      <code className="text-xs font-mono text-[var(--accent)] shrink-0 w-44">{name}</code>
      <code className="text-xs font-mono text-[var(--text-muted)] shrink-0 w-20">{type}</code>
      {req && <Badge variant="destructive" className="text-[0.6rem] px-1 py-0 shrink-0">required</Badge>}
      <span className="text-xs text-[var(--text-secondary)] flex-1">{desc}</span>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET:    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
    POST:   'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300',
    PATCH:  'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300',
    DELETE: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[0.68rem] font-mono font-semibold border ${colors[method] ?? ''}`}>
      {method}
    </span>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div className="flex items-center gap-2 my-2">
      <MethodBadge method={method} />
      <code className="text-xs font-mono text-[var(--text-primary)]">{path}</code>
      <span className="text-xs text-[var(--text-muted)]">— {desc}</span>
    </div>
  );
}

function Callout({ type = 'info', children }: { type?: 'info' | 'warn' | 'tip'; children: React.ReactNode }) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300',
    warn: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300',
    tip:  'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300',
  };
  return (
    <div className={`text-xs leading-relaxed border rounded-[var(--radius)] px-4 py-3 my-3 ${styles[type]}`}>
      {children}
    </div>
  );
}

// ─── Section content ───────────────────────────────────────────────────────────

function Overview() {
  return (
    <div>
      <P>
        Buzz is a standalone notification microservice you self-host alongside your application.
        It supports four channels — <strong>email</strong>, <strong>SMS</strong>, <strong>push</strong>, and <strong>in-app</strong> —
        through a single REST API. Your backend never calls SendGrid, Twilio, or FCM directly; it calls Buzz.
      </P>
      <H2>Architecture</H2>
      <Code lang="text">{`
Your backend  ──POST /api/v1/notifications──►  Buzz Service  ──►  SendGrid / Twilio / FCM
                                                     │
                                                     ▼
                                               PostgreSQL + Redis
                                                     │
                                                     ▼ SSE (real-time push)
Your frontend  ◄────── inbox_update event ─────── Buzz Service
      `}</Code>
      <P>
        Buzz stores every notification in Postgres and queues delivery through Redis.
        It is stateless — you can run multiple instances behind a load balancer.
      </P>
      <H2>Key Concepts</H2>
      <div className="space-y-2 mt-2">
        {[
          ['API Key',      'A scoped bearer token your backend services use to call Buzz. Generate them per-environment in the Settings panel.'],
          ['Application',  'An isolated workspace (tenant). All resources — templates, API keys, notifications — belong to one application.'],
          ['Template',     'A reusable message definition with {{variable}} placeholders substituted at send time.'],
          ['Datasource',   'A registered external API endpoint (your master backend) Buzz calls to fetch recipient lists for batch jobs.'],
          ['Batch',        'A fan-out job: fetch recipients from a datasource → render template → send notifications to each.'],
          ['SSE Stream',   'A persistent HTTP/1.1 connection (text/event-stream) that pushes events to connected browser clients in real time.'],
          ['Inbox',        'A per-user message store for in_app channel notifications, backed by the database.'],
        ].map(([term, def]) => (
          <div key={term} className="flex gap-3 text-sm">
            <code className="font-mono text-[var(--accent)] shrink-0 w-28 pt-0.5 text-xs">{term}</code>
            <span className="text-[var(--text-secondary)]">{def}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickStart() {
  return (
    <div>
      <P>Get your first notification delivered in under 5 minutes.</P>

      <H2>Step 1 — Get your API key</H2>
      <P>Log in to the Buzz dashboard → <strong>Settings</strong> → <strong>Generate New Key</strong>. Copy the raw key (shown only once).</P>

      <H2>Step 2 — Send your first notification</H2>
      <Code lang="bash">{`
curl -X POST https://your-buzz-host/api/v1/notifications \\
  -H "Authorization: Bearer bz_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "user@example.com",
    "channel": "email",
    "subject": "Hello from Buzz!",
    "body": "Your Buzz integration is working correctly.",
    "priority": "normal"
  }'
      `}</Code>

      <H2>Step 3 — Send an in-app notification</H2>
      <Code lang="bash">{`
curl -X POST https://your-buzz-host/api/v1/notifications \\
  -H "Authorization: Bearer bz_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "user-uuid-or-id",
    "channel": "in_app",
    "subject": "Welcome aboard!",
    "body": "Your account is ready to use."
  }'
      `}</Code>

      <H2>Step 4 — Read the inbox</H2>
      <Code lang="bash">{`
curl https://your-buzz-host/api/v1/inbox \\
  -H "Authorization: Bearer bz_live_YOUR_API_KEY" \\
  -H "X-User-ID: user-uuid-or-id"
      `}</Code>

      <Callout type="tip">
        The <code>X-User-ID</code> header scopes inbox reads/writes to a specific end-user.
        This is your user's ID in your own system — any opaque string works.
      </Callout>

      <H2>Step 5 — Connect real-time SSE</H2>
      <Code lang="js">{`
const es = new EventSource(
  \`https://your-buzz-host/api/v1/stream\` +
  \`?token=\${encodeURIComponent('bz_live_YOUR_API_KEY')}\` +
  \`&user_id=\${encodeURIComponent('user-uuid-or-id')}\`
);

es.addEventListener('notification', (ev) => {
  const { type } = JSON.parse(ev.data);
  if (type === 'inbox_update') {
    refetchInbox(); // re-fetch your inbox API
  }
});
      `}</Code>

      <Callout type="info">
        <code>EventSource</code> does not support custom HTTP headers — pass authentication via query parameters.
      </Callout>
    </div>
  );
}

function Auth() {
  return (
    <div>
      <P>
        All API endpoints (except <code>/health</code>) require a Bearer token in the <code>Authorization</code> header.
        Buzz supports two token types:
      </P>

      <H2>API Keys (for 3rd-party / backend services)</H2>
      <P>
        Generate scoped API keys from the Settings panel. These are intended for your backend services, CI pipelines,
        and any external system that needs to send or query notifications.
      </P>
      <Code lang="http">{`
Authorization: Bearer bz_live_xxxxxxxxxxxxxxxxxxxx
X-User-ID: user_123
      `}</Code>
      <P>
        The <code>X-User-ID</code> header scopes inbox reads to a specific end-user and is required for all
        inbox, device, and SSE endpoints.
      </P>

      <H2>JWT Tokens (for dashboard users)</H2>
      <P>
        Dashboard users authenticate with email/password and receive a short-lived JWT. The dashboard sends this
        automatically on every request via <code>Authorization: Bearer &lt;jwt&gt;</code> plus
        the <code>X-Application-ID</code> header to scope to a workspace.
      </P>
      <Callout type="info">
        3rd-party integrations should always use API keys, not JWTs. JWTs are for the dashboard UI only.
      </Callout>

      <H2>Scopes</H2>
      <P>Each API key is issued with one or more scopes. Calling an endpoint without the required scope returns <code>403</code>.</P>
      <div className="mt-2 border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden">
        {[
          ['notification:send',  'Send individual notifications'],
          ['notification:read',  'List and retrieve notifications'],
          ['template:write',     'Create, update, delete templates'],
          ['template:read',      'List and retrieve templates'],
          ['batch:send',         'Submit batch jobs and register datasources'],
          ['batch:read',         'List batches and view status'],
          ['device:write',       'Register / unregister push device tokens'],
          ['device:read',        'List device tokens for a user'],
          ['inbox:read',         'Read inbox entries'],
          ['*',                  'Wildcard — grants all scopes (use for dev only)'],
        ].map(([scope, desc]) => (
          <div key={scope} className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-color)] last:border-0">
            <code className="font-mono text-xs text-[var(--accent)] w-44 shrink-0">{scope}</code>
            <span className="text-xs text-[var(--text-secondary)]">{desc}</span>
          </div>
        ))}
      </div>
      <Callout type="warn">
        For production, issue narrowly-scoped keys per service. Never share keys between environments.
      </Callout>
    </div>
  );
}

function Templates() {
  return (
    <div>
      <P>
        Templates let you define a message once and reuse it. Variables are written as{' '}
        <code className="font-mono text-xs mx-1 px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)]">{`{{variable_name}}`}</code>
        in subject and body — Buzz substitutes them at send time.
      </P>
      <H2>Create a template</H2>
      <Endpoint method="POST" path="/api/v1/templates" desc="Create a new template" />
      <Code>{`
{
  "name": "welcome_email",
  "channels": ["email", "in_app"],
  "subject": "Welcome, {{name}}!",
  "body": "Hi {{name}},\\n\\nWelcome to {{company}}. Your account is ready.\\n\\nRegards,\\nThe Team",
  "variables": ["name", "company"]
}
      `}</Code>
      <div className="mt-2 border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden">
        <Field name="name"      type="string"   req  desc="Unique slug. Lowercase, underscores. Used when referencing this template in send requests." />
        <Field name="channels"  type="string[]" req  desc="Channels this template supports: email, sms, push, in_app." />
        <Field name="subject"   type="string"       desc="Email subject. Required for email channel. Supports {{variables}}." />
        <Field name="body"      type="string"   req  desc="Message body. Supports {{variables}} placeholders." />
        <Field name="variables" type="string[]"     desc="Declare expected variable names. Auto-detected from body/subject if omitted." />
      </div>

      <H2>Endpoints</H2>
      <Endpoint method="GET"    path="/api/v1/templates"        desc="List all templates (paginated)" />
      <Endpoint method="GET"    path="/api/v1/templates/:name"  desc="Get a single template" />
      <Endpoint method="PATCH"  path="/api/v1/templates/:name"  desc="Update subject, body, or active status" />
      <Endpoint method="DELETE" path="/api/v1/templates/:name"  desc="Soft-delete a template" />

      <Callout type="tip">
        Email requires a <code>subject</code>. SMS and push do not. A multi-channel template can include a subject — it will be ignored for non-email channels.
      </Callout>
    </div>
  );
}

function Send() {
  return (
    <div>
      <P>Send a single notification to one recipient on one channel.</P>
      <Endpoint method="POST" path="/api/v1/notifications" desc="Queue a notification" />

      <H2>Direct send (no template)</H2>
      <Code>{`
{
  "to": "user@example.com",
  "channel": "email",
  "subject": "Your order shipped",
  "body": "Order #12345 is on its way.",
  "priority": "normal"
}
      `}</Code>

      <H2>Template send</H2>
      <Code>{`
{
  "to": "user@example.com",
  "channel": "email",
  "template": "welcome_email",
  "data": {
    "name": "Alice",
    "company": "Acme Corp"
  }
}
      `}</Code>

      <H2>In-app notification</H2>
      <P>
        For <code>in_app</code>, the <code>to</code> field is the user's ID in your system — not an email.
        The message lands in the user's persistent inbox, queryable via <code>GET /api/v1/inbox</code>.
      </P>
      <Code>{`
{
  "to": "user-uuid-123",
  "channel": "in_app",
  "subject": "New message",
  "body": "You have a new message from Alice.",
  "priority": "normal"
}
      `}</Code>

      <H2>Request fields</H2>
      <div className="border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden">
        <Field name="to"              type="string"  req  desc="Recipient address. Email for email, E.164 phone for SMS (+1234567890), device token for push, user ID for in_app." />
        <Field name="channel"         type="string"  req  desc="email | sms | push | in_app" />
        <Field name="template"        type="string"      desc="Template name. If provided, body/subject come from the template." />
        <Field name="body"            type="string"      desc="Message body. Required if no template." />
        <Field name="subject"         type="string"      desc="Email subject. Required for email if no template." />
        <Field name="data"            type="object"      desc='Variable values for template substitution: {"name": "Alice"}.' />
        <Field name="priority"        type="string"      desc="low | normal | high | urgent — affects queue ordering." />
        <Field name="idempotency_key" type="string"      desc="If provided, Buzz deduplicates: a second request with the same key returns the original notification." />
        <Field name="scheduled_for"   type="ISO8601"     desc="Future timestamp to schedule delivery. Omit for immediate delivery." />
      </div>
    </div>
  );
}

function Inbox() {
  return (
    <div>
      <P>
        The inbox is a persistent, per-user message store for the <code>in_app</code> channel.
        When you send an <code>in_app</code> notification, Buzz automatically creates an inbox entry for the recipient.
        Your frontend fetches this to render a notification bell or message list.
      </P>

      <H2>Fetch inbox</H2>
      <Endpoint method="GET" path="/api/v1/inbox" desc="Get current user's inbox" />
      <P>Requires <code>X-User-ID</code> header to scope to a user.</P>
      <Code lang="bash">{`
curl https://your-buzz-host/api/v1/inbox?limit=20&unread=false \\
  -H "Authorization: Bearer bz_live_YOUR_API_KEY" \\
  -H "X-User-ID: user-uuid-123"
      `}</Code>
      <Code>{`
{
  "data": [
    {
      "id": "...",
      "title": "New message",
      "body": "You have a new message from Alice.",
      "is_read": false,
      "created_at": "2026-05-20T12:00:00Z"
    }
  ],
  "total": 1,
  "unread_count": 1,
  "limit": 20,
  "offset": 0
}
      `}</Code>

      <H2>Inbox endpoints</H2>
      <Endpoint method="GET"   path="/api/v1/inbox"                desc="List inbox entries (paginated)" />
      <Endpoint method="PATCH" path="/api/v1/inbox/:id/read"       desc="Mark single entry as read" />
      <Endpoint method="POST"  path="/api/v1/inbox/read-all"       desc="Mark all entries as read" />
      <Endpoint method="DELETE" path="/api/v1/inbox/:id"           desc="Delete an inbox entry" />

      <H2>Query parameters</H2>
      <div className="border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden">
        <Field name="unread" type="boolean" desc="Return only unread entries. Default: false." />
        <Field name="limit"  type="integer" desc="Page size. Default: 20, max: 100." />
        <Field name="offset" type="integer" desc="Page offset. Default: 0." />
      </div>

      <Callout type="info">
        Combine inbox polling with the SSE stream for real-time updates. The SSE endpoint fires an
        <code>inbox_update</code> event when a new in_app notification arrives for the user.
        Re-fetch the inbox on that event rather than maintaining local state.
      </Callout>
    </div>
  );
}

function Datasources() {
  return (
    <div>
      <P>
        A <strong>Datasource</strong> is a registration that tells Buzz how to call your master backend to
        fetch a recipient list. Register it once; batch jobs reference it by name.
      </P>

      <H2>Register a datasource</H2>
      <Endpoint method="POST" path="/api/v1/datasources" desc="Register an external API" />
      <Code>{`
{
  "name": "master_backend",
  "base_url": "https://api.yourapp.com",
  "auth_type": "bearer",
  "auth_config": {
    "token": "your-internal-service-token"
  },
  "endpoints": {
    "active_users": {
      "path": "/internal/users/active",
      "method": "GET",
      "pagination_style": "offset",
      "response_format": {
        "recipients_key": "users",
        "email_field":    "email",
        "name_field":     "full_name",
        "phone_field":    "phone_number"
      }
    }
  }
}
      `}</Code>

      <H2>Your backend must return</H2>
      <Code>{`
{
  "users": [
    { "id": "usr_1", "email": "alice@example.com", "full_name": "Alice" },
    { "id": "usr_2", "email": "bob@example.com",   "full_name": "Bob"   }
  ]
}
      `}</Code>
      <P>Buzz paginates with <code>offset</code> until it receives an empty array.</P>

      <H2>Authentication types</H2>
      <div className="border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden">
        <Field name="bearer"  type="auth_type" desc='auth_config: { "token": "..." } — adds Authorization: Bearer <token>' />
        <Field name="basic"   type="auth_type" desc='auth_config: { "username": "...", "password": "..." } — HTTP Basic auth' />
        <Field name="api_key" type="auth_type" desc='auth_config: { "header": "X-API-Key", "key": "..." } — custom header' />
      </div>

      <H2>Endpoints</H2>
      <Endpoint method="GET"    path="/api/v1/datasources"     desc="List all registered datasources" />
      <Endpoint method="GET"    path="/api/v1/datasources/:id" desc="Get datasource by ID" />
      <Endpoint method="PATCH"  path="/api/v1/datasources/:id" desc="Update base_url, auth, or endpoints" />
      <Endpoint method="DELETE" path="/api/v1/datasources/:id" desc="Deactivate (soft delete)" />
    </div>
  );
}

function Batch() {
  return (
    <div>
      <P>
        A batch job fetches all recipients from a datasource, renders a template for each one, and
        queues individual notifications. Send to 10,000 users with one API call.
      </P>

      <H2>Full workflow</H2>
      <Code lang="text">{`
1. Register datasource  →  POST /api/v1/datasources
2. Create template      →  POST /api/v1/templates
3. Send batch           →  POST /api/v1/batches/send
4. Poll status          →  GET  /api/v1/batches/:id
      `}</Code>

      <H2>Send a batch</H2>
      <Endpoint method="POST" path="/api/v1/batches/send" desc="Queue a batch job" />
      <Code>{`
{
  "datasource_name":  "master_backend",
  "endpoint_name":    "active_users",
  "template_name":    "welcome_email",
  "template_data":    { "company": "Acme Corp" },
  "channel":          "email",
  "priority":         "normal",
  "idempotency_key":  "campaign_2026_q2_welcome"
}
      `}</Code>

      <H2>Batch statuses</H2>
      <div className="border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden mt-2">
        {[
          ['pending',    'Job created, waiting in queue'],
          ['fetching',   'Calling your datasource to collect recipients'],
          ['queued',     'Recipients collected, about to start sending'],
          ['delivering', 'Sending notifications to recipients'],
          ['completed',  'All notifications dispatched'],
          ['failed',     'Fatal error — check error_message field'],
        ].map(([status, desc]) => (
          <div key={status} className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-color)] last:border-0">
            <code className="font-mono text-xs text-[var(--accent)] w-24 shrink-0">{status}</code>
            <span className="text-xs text-[var(--text-secondary)]">{desc}</span>
          </div>
        ))}
      </div>

      <Endpoint method="GET" path="/api/v1/batches/:id" desc="Get status and counts" />
      <Code>{`
{
  "batch_id":  "550e8400-...",
  "status":    "delivering",
  "total":     4820,
  "sent":      1340,
  "failed":    3,
  "skipped":   0
}
      `}</Code>
    </div>
  );
}

function SSE() {
  return (
    <div>
      <P>
        Buzz pushes real-time events to your frontend via Server-Sent Events (SSE). The primary use-case is
        inbox invalidation — your client opens one persistent connection on login and automatically
        re-fetches the inbox when a new in_app notification arrives.
      </P>

      <H2>Connect with an API key (recommended for 3rd-party apps)</H2>
      <Endpoint method="GET" path="/api/v1/stream" desc="Open SSE connection" />
      <P>
        Pass credentials as query parameters — the browser's <code>EventSource</code> API does not support custom HTTP headers.
      </P>
      <Code lang="js">{`
// Using an API key (for external/embedded apps)
const API_KEY = 'bz_live_YOUR_API_KEY';
const USER_ID = 'your-end-user-id';
const BUZZ_URL = 'https://your-buzz-host';

const es = new EventSource(
  \`\${BUZZ_URL}/api/v1/stream\` +
  \`?token=\${encodeURIComponent(API_KEY)}\` +
  \`&user_id=\${encodeURIComponent(USER_ID)}\`
);
      `}</Code>

      <H2>Connect with a JWT token (for dashboard / logged-in users)</H2>
      <P>
        If your user is logged in to the Buzz dashboard, reuse their JWT token instead of an API key.
        The backend accepts both token types via the <code>token</code> query parameter.
      </P>
      <Code lang="js">{`
// Using a JWT token (from localStorage after login)
const jwtToken = localStorage.getItem('buzz_jwt_token');
const userId   = localStorage.getItem('buzz_user_id');

const es = new EventSource(
  \`\${BUZZ_URL}/api/v1/stream\` +
  \`?token=\${encodeURIComponent(jwtToken)}\` +
  \`&user_id=\${encodeURIComponent(userId)}\`
);
      `}</Code>

      <Callout type="warn">
        Do NOT pass <code>{'{ withCredentials: true }'}</code> to <code>EventSource</code>. The Buzz server uses
        wildcard CORS (<code>AllowOrigins: "*"</code>) which is incompatible with credentialed requests.
        Credentials are passed via query params instead.
      </Callout>

      <H2>Events</H2>
      <div className="border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden mt-2">
        {[
          ['connected',    'Fired immediately on successful connection. Payload: { status: "connected", time: "..." }'],
          ['notification', 'Fired when a new event is published for this user. Check payload.type for the event kind.'],
          ['ping',         'Heartbeat every 30 seconds to keep the connection alive through proxies.'],
        ].map(([event, desc]) => (
          <div key={event} className="flex items-start gap-3 px-4 py-2.5 border-b border-[var(--border-color)] last:border-0">
            <code className="font-mono text-xs text-[var(--accent)] w-28 shrink-0 pt-0.5">{event}</code>
            <span className="text-xs text-[var(--text-secondary)]">{desc}</span>
          </div>
        ))}
      </div>

      <H2>Notification event payload types</H2>
      <div className="border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden mt-2">
        {[
          ['inbox_update', 'A new in_app notification arrived for this user. Re-fetch the inbox API.'],
        ].map(([type, desc]) => (
          <div key={type} className="flex items-start gap-3 px-4 py-2.5 border-b border-[var(--border-color)] last:border-0">
            <code className="font-mono text-xs text-[var(--accent)] w-28 shrink-0 pt-0.5">{type}</code>
            <span className="text-xs text-[var(--text-secondary)]">{desc}</span>
          </div>
        ))}
      </div>

      <H2>Inbox invalidation pattern</H2>
      <Code lang="js">{`
// 1. Fetch inbox on page mount
const inbox = await fetch(\`\${BUZZ_URL}/api/v1/inbox\`, {
  headers: {
    Authorization: \`Bearer \${API_KEY}\`,
    'X-User-ID': USER_ID,
  }
}).then(r => r.json());

// 2. Open SSE — stays open for the session
const es = new EventSource(
  \`\${BUZZ_URL}/api/v1/stream?token=\${encodeURIComponent(API_KEY)}&user_id=\${encodeURIComponent(USER_ID)}\`
);

es.addEventListener('notification', (ev) => {
  const data = JSON.parse(ev.data);
  if (data.type === 'inbox_update') {
    // 3. Re-fetch inbox from server — single source of truth
    refetchInbox();
  }
});

es.onerror = () => {
  // EventSource reconnects automatically — no manual retry needed
  console.warn('SSE connection lost, browser will reconnect...');
};
      `}</Code>

      <H2>Online user count</H2>
      <Endpoint method="GET" path="/api/v1/stream/stats" desc="Get active connection stats" />
      <Code>{`
{ "online_users": 142, "total_connections": 156 }
      `}</Code>
      <P>
        <code>online_users</code> = unique user IDs. <code>total_connections</code> counts each browser tab separately.
      </P>

      <Callout type="warn">
        SSE connections count against your server's open file descriptor limit.
        For {'>'} 1,000 concurrent users, run multiple Buzz instances behind a load balancer —
        Redis Pub/Sub handles cross-instance fanout automatically.
      </Callout>
    </div>
  );
}

function ReactIntegration() {
  return (
    <div>
      <P>
        This section shows how to integrate Buzz into a React application using a reusable custom hook.
        The pattern works with any React framework — Next.js, Vite, Create React App.
      </P>

      <H2>Installation — no extra dependencies needed</H2>
      <P>
        The browser's built-in <code>EventSource</code> API is used directly. No additional npm packages required.
      </P>

      <H2>useBuzzSSE hook</H2>
      <P>
        Copy this hook into your project. It manages the SSE connection lifecycle, automatic reconnection,
        and fires a callback when your inbox should be refreshed.
      </P>
      <Code lang="tsx">{`
// hooks/useBuzzSSE.ts
import { useEffect, useRef, useState, useCallback } from 'react';

interface BuzzSSEOptions {
  buzzUrl: string;       // e.g. 'https://your-buzz-host'
  apiKey: string;        // your API key from Buzz Settings
  userId: string;        // your end-user's ID
  onInboxUpdate?: () => void;  // called when a new in_app notification arrives
}

export function useBuzzSSE({ buzzUrl, apiKey, userId, onInboxUpdate }: BuzzSSEOptions) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const esRef = useRef<EventSource | null>(null);
  const onUpdateRef = useRef(onInboxUpdate);
  onUpdateRef.current = onInboxUpdate;

  const connect = useCallback(() => {
    if (esRef.current) return;

    const url =
      \`\${buzzUrl}/api/v1/stream\` +
      \`?token=\${encodeURIComponent(apiKey)}\` +
      \`&user_id=\${encodeURIComponent(userId)}\`;

    setStatus('connecting');
    const es = new EventSource(url); // No withCredentials: true !

    es.addEventListener('connected', () => setStatus('connected'));

    es.addEventListener('notification', (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.type === 'inbox_update') {
          onUpdateRef.current?.();
        }
      } catch {}
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setStatus('disconnected');
        esRef.current = null;
      } else {
        setStatus('error');
      }
    };

    esRef.current = es;
  }, [buzzUrl, apiKey, userId]);

  const disconnect = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return { status, connect, disconnect };
}
      `}</Code>

      <H2>Using the hook in a component</H2>
      <Code lang="tsx">{`
// components/NotificationBell.tsx
import { useState, useEffect, useCallback } from 'react';
import { useBuzzSSE } from '@/hooks/useBuzzSSE';

const BUZZ_URL = process.env.NEXT_PUBLIC_BUZZ_URL!;
const API_KEY  = process.env.NEXT_PUBLIC_BUZZ_API_KEY!;

export function NotificationBell({ userId }: { userId: string }) {
  const [inbox, setInbox] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchInbox = useCallback(async () => {
    const res = await fetch(\`\${BUZZ_URL}/api/v1/inbox?limit=20\`, {
      headers: {
        Authorization: \`Bearer \${API_KEY}\`,
        'X-User-ID': userId,
      },
    });
    const data = await res.json();
    setInbox(data.data ?? []);
    setUnreadCount(data.unread_count ?? 0);
  }, [userId]);

  // Connect SSE — auto-refetch on new notification
  const { status } = useBuzzSSE({
    buzzUrl: BUZZ_URL,
    apiKey: API_KEY,
    userId,
    onInboxUpdate: fetchInbox,
  });

  // Load on mount
  useEffect(() => { fetchInbox(); }, [fetchInbox]);

  return (
    <div>
      <span>🔔 {unreadCount > 0 && <span>{unreadCount}</span>}</span>
      <span style={{ fontSize: 10, color: status === 'connected' ? 'green' : 'gray' }}>
        {status}
      </span>
      <ul>
        {inbox.map(item => (
          <li key={item.id} style={{ fontWeight: item.is_read ? 'normal' : 'bold' }}>
            {item.title} — {item.body}
          </li>
        ))}
      </ul>
    </div>
  );
}
      `}</Code>

      <H2>Environment variables</H2>
      <Code lang="bash">{`
# .env.local (Next.js) or .env (Vite)
NEXT_PUBLIC_BUZZ_URL=https://your-buzz-host
NEXT_PUBLIC_BUZZ_API_KEY=bz_live_YOUR_API_KEY
      `}</Code>

      <Callout type="tip">
        For authenticated users, swap the API key for your user's session JWT — read it from your auth store
        and pass it as <code>apiKey</code> to the hook. The Buzz backend accepts both.
      </Callout>

      <H2>Sending a notification from your React app (backend action)</H2>
      <P>
        Notifications should be sent from your <strong>backend</strong>, not directly from React — this protects your API key.
        Trigger notifications server-side (Next.js Route Handlers, Express, etc.):
      </P>
      <Code lang="ts">{`
// app/api/notify/route.ts  (Next.js App Router)
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { userId, message } = await request.json();

  const res = await fetch(\`\${process.env.BUZZ_URL}/api/v1/notifications\`, {
    method: 'POST',
    headers: {
      Authorization: \`Bearer \${process.env.BUZZ_API_KEY}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: userId,
      channel: 'in_app',
      subject: 'New notification',
      body: message,
    }),
  });

  const data = await res.json();
  return NextResponse.json(data);
}
      `}</Code>
    </div>
  );
}

function AIPrompt() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const prompts: { id: string; title: string; desc: string; prompt: string }[] = [
    {
      id: 'full-integration',
      title: 'Full Integration — Any Backend',
      desc: 'Give this to your AI agent to implement a full Buzz integration from scratch.',
      prompt: `I need to integrate the Buzz Notification Service into my application.

Buzz is a self-hosted REST notification microservice. Here is everything you need to know:

BASE URL: https://your-buzz-host
AUTHENTICATION: All requests need: Authorization: Bearer <API_KEY>
For inbox and SSE endpoints also add: X-User-ID: <end-user-id>

KEY ENDPOINTS:
1. Send notification: POST /api/v1/notifications
   Body: { "to": "<email|phone|userId>", "channel": "email|sms|push|in_app", "subject": "...", "body": "...", "priority": "normal" }

2. Get user inbox: GET /api/v1/inbox?limit=20
   Header: X-User-ID: <userId>
   Returns: { data: [...], unread_count: N }

3. Mark as read: PATCH /api/v1/inbox/:id/read

4. Real-time SSE: GET /api/v1/stream?token=<API_KEY>&user_id=<userId>
   - Use browser EventSource API (no custom headers supported)
   - Listen for 'notification' events; if data.type === 'inbox_update', re-fetch inbox
   - Do NOT use { withCredentials: true } — server uses wildcard CORS

5. Create template: POST /api/v1/templates
   Body: { "name": "slug", "channels": ["email"], "subject": "Hi {{name}}", "body": "..." }

6. Send via template: POST /api/v1/notifications
   Body: { "to": "...", "channel": "email", "template": "template_slug", "data": { "name": "Alice" } }

Please implement:
- A service/utility function to send notifications via Buzz
- A React hook (useBuzzSSE) that connects to SSE, listens for inbox_update events, and fires a callback
- A NotificationBell component that shows unread count and inbox list, auto-updating via SSE
- Environment variable configuration`,
    },
    {
      id: 'react-hook',
      title: 'React SSE Hook Only',
      desc: 'Just need the SSE integration for React? Use this focused prompt.',
      prompt: `Create a React custom hook called useBuzzSSE that integrates with the Buzz Notification Service real-time SSE stream.

Requirements:
- The hook accepts: { buzzUrl, apiKey, userId, onInboxUpdate }
- It connects to: GET <buzzUrl>/api/v1/stream?token=<apiKey>&user_id=<userId>
- Use the browser's built-in EventSource API
- IMPORTANT: Do NOT pass { withCredentials: true } to EventSource — the server uses wildcard CORS
- Listen for the 'connected' event to set status to 'connected'
- Listen for 'notification' events: parse JSON and if data.type === 'inbox_update', call onInboxUpdate()
- Handle reconnection: on onerror, if readyState !== CLOSED, set status to 'error'; EventSource reconnects automatically
- Clean up the connection on component unmount
- Return { status } where status is 'connecting' | 'connected' | 'disconnected' | 'error'

Also create a simple component that:
1. Fetches inbox from GET /api/v1/inbox with headers: Authorization: Bearer <apiKey>, X-User-ID: <userId>
2. Uses useBuzzSSE with onInboxUpdate pointing to the refetch function
3. Displays unread count and message list`,
    },
    {
      id: 'backend-integration',
      title: 'Backend Service Integration',
      desc: 'For adding Buzz notifications to a Node.js / Python / Go backend.',
      prompt: `I want to integrate Buzz Notification Service into my backend service to send notifications to users.

Buzz API details:
- Base URL: https://your-buzz-host
- Auth header: Authorization: Bearer <BUZZ_API_KEY>
- Send notification endpoint: POST /api/v1/notifications

Request body for email:
{
  "to": "user@example.com",
  "channel": "email",
  "subject": "Your message",
  "body": "Hello!",
  "priority": "normal"
}

Request body for in-app notification:
{
  "to": "user-id-string",
  "channel": "in_app",
  "subject": "New alert",
  "body": "Something happened!"
}

Request body using a template:
{
  "to": "user@example.com",
  "channel": "email",
  "template": "template_name",
  "data": { "name": "Alice", "company": "Acme" }
}

Please implement:
1. A BuzzClient class/service that wraps the HTTP calls with proper error handling
2. Methods: sendEmail(to, subject, body), sendInApp(userId, subject, body), sendWithTemplate(to, channel, templateName, data)
3. Proper TypeScript types for request/response
4. Environment variable configuration (BUZZ_URL, BUZZ_API_KEY)
5. Retry logic for failed sends`,
    },
    {
      id: 'batch-prompt',
      title: 'Batch Notification Campaign',
      desc: 'For sending bulk notifications to many users from your datasource.',
      prompt: `I want to send a batch notification campaign through Buzz Notification Service.

Buzz Batch API:
1. Register a datasource (your user-list endpoint):
   POST /api/v1/datasources
   Body: {
     "name": "my_backend",
     "base_url": "https://my-api.com",
     "auth_type": "bearer",
     "auth_config": { "token": "my-service-token" },
     "endpoints": {
       "all_users": {
         "path": "/users",
         "method": "GET",
         "pagination_style": "offset",
         "response_format": {
           "recipients_key": "users",
           "email_field": "email",
           "name_field": "name"
         }
       }
     }
   }
   Your /users endpoint must respond: { "users": [{ "email": "...", "name": "..." }] }
   Buzz paginates with ?offset=0&limit=100 until it gets an empty array.

2. Create a template:
   POST /api/v1/templates
   Body: { "name": "promo_email", "channels": ["email"], "subject": "{{company}} — Special offer for {{name}}", "body": "Hi {{name}}, ..." }

3. Send batch:
   POST /api/v1/batches/send
   Body: {
     "datasource_name": "my_backend",
     "endpoint_name": "all_users",
     "template_name": "promo_email",
     "template_data": { "company": "Acme Corp" },
     "channel": "email",
     "idempotency_key": "campaign_2026_q2"
   }

4. Poll status: GET /api/v1/batches/:id
   Returns: { status: "delivering", total: 5000, sent: 1200, failed: 0 }

Please implement a complete batch campaign script/service for my stack that:
- Registers the datasource if not already registered
- Creates or updates the template
- Submits the batch job
- Polls until completion and logs progress`,
    },
  ];

  return (
    <div>
      <P>
        Most developers today use AI coding agents (Cursor, GitHub Copilot, Claude, Gemini) to implement integrations.
        These ready-made prompts give your AI agent all the context it needs about Buzz's API to generate
        correct, working integration code in one shot.
      </P>
      <Callout type="tip">
        Click <strong>Copy</strong> on any prompt below, then paste it directly into your AI agent's chat.
        Replace placeholder values like <code>https://your-buzz-host</code> and <code>bz_live_YOUR_API_KEY</code> with your actual values.
      </Callout>

      <div className="space-y-5 mt-4">
        {prompts.map(({ id, title, desc, prompt }) => (
          <div key={id} className="border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden">
            <div className="flex items-start justify-between px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">{desc}</div>
              </div>
              <button
                onClick={() => copy(id, prompt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity shrink-0 ml-4"
              >
                {copiedId === id ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy Prompt</>}
              </button>
            </div>
            <pre className="text-xs font-mono text-[var(--text-secondary)] p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed bg-[var(--bg-tertiary)] max-h-48 overflow-y-auto">
              {prompt.trim()}
            </pre>
          </div>
        ))}
      </div>

      <H2>Tips for best results</H2>
      <div className="space-y-2 mt-2">
        {[
          ['Be specific about your stack', 'Add "using Next.js App Router", "using Express", "in Python with FastAPI" etc. to the prompt.'],
          ['Replace placeholders first', 'Swap https://your-buzz-host and bz_live_YOUR_API_KEY with real values before pasting.'],
          ['Mention your user ID format', 'If your user IDs are UUIDs, strings, or integers, say so — the AI will type them correctly.'],
          ['Request tests', 'Append "Also write unit tests for the service layer" to any prompt.'],
        ].map(([tip, detail]) => (
          <div key={tip} className="text-xs border border-[var(--border-color)] rounded-[var(--radius)] p-3">
            <div className="font-semibold text-[var(--text-primary)] mb-0.5">{tip}</div>
            <div className="text-[var(--text-muted)]">{detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersSection() {
  return (
    <div>
      <P>
        Buzz features built-in multi-tenant isolation through <strong>Application Workspaces</strong> and
        role-based access control (RBAC). Self-registration is disabled for production. Users are created
        and managed by system owners via the Users panel.
      </P>

      <H2>System Roles</H2>
      <div className="mt-2 border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden">
        {[
          ['owner', 'Root administrators. Access to all workspaces, can manage system users and register new workspaces.'],
          ['user',  'Standard accounts. No workspace access by default — must be explicitly granted per application.'],
        ].map(([role, desc]) => (
          <div key={role} className="flex items-start gap-3 px-4 py-2 border-b border-[var(--border-color)] last:border-0">
            <code className="font-mono text-xs text-[var(--accent)] w-28 shrink-0">{role}</code>
            <span className="text-xs text-[var(--text-secondary)]">{desc}</span>
          </div>
        ))}
      </div>

      <H2>Workspace Membership Roles</H2>
      <div className="mt-2 border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden">
        {[
          ['admin',  'Full control over the workspace: manage API keys, providers, members.'],
          ['member', 'Read and send permissions. Cannot modify settings or credentials.'],
        ].map(([role, desc]) => (
          <div key={role} className="flex items-start gap-3 px-4 py-2 border-b border-[var(--border-color)] last:border-0">
            <code className="font-mono text-xs text-[var(--accent)] w-28 shrink-0">{role}</code>
            <span className="text-xs text-[var(--text-secondary)]">{desc}</span>
          </div>
        ))}
      </div>

      <H2>User Management Endpoints (Owner only)</H2>
      <Endpoint method="GET"    path="/api/v1/users"     desc="List all system users" />
      <Endpoint method="POST"   path="/api/v1/users"     desc="Create a new user" />
      <Endpoint method="DELETE" path="/api/v1/users/:id" desc="Permanently delete a user" />
      <Code>{`
// POST /api/v1/users
{
  "name": "Jane Doe",
  "email": "jane@company.com",
  "password": "securepassword123",
  "role": "user"
}
      `}</Code>

      <H2>Workspace Member Endpoints</H2>
      <Endpoint method="GET"    path="/api/v1/applications/:appId/members"           desc="List workspace members" />
      <Endpoint method="POST"   path="/api/v1/applications/:appId/members"           desc="Grant user access to workspace" />
      <Endpoint method="DELETE" path="/api/v1/applications/:appId/members/:userId"   desc="Revoke user access" />
      <Code>{`
// POST /api/v1/applications/:appId/members
{
  "email": "jane@company.com",
  "role": "member"
}
      `}</Code>
    </div>
  );
}

function Errors() {
  return (
    <div>
      <P>All errors follow a consistent shape:</P>
      <Code>{`
{
  "error":   "validation failed",
  "details": "'to' field is required"
}
      `}</Code>
      <H2>HTTP status codes</H2>
      <div className="border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden mt-2">
        {[
          ['200', 'OK — idempotent duplicate (batch, notification)'],
          ['201', 'Created'],
          ['202', 'Accepted — notification or batch queued'],
          ['400', 'Bad request — missing field, invalid format, or validation error'],
          ['401', 'Unauthorized — missing or invalid API key / JWT'],
          ['403', 'Forbidden — API key lacks the required scope'],
          ['404', 'Not found — resource does not exist'],
          ['500', 'Internal error — check service logs'],
          ['503', 'Service unavailable — database or Redis down'],
        ].map(([code, desc]) => (
          <div key={code} className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-color)] last:border-0">
            <code className="font-mono text-xs text-[var(--accent)] w-12 shrink-0">{code}</code>
            <span className="text-xs text-[var(--text-secondary)]">{desc}</span>
          </div>
        ))}
      </div>
      <H2>Common mistakes</H2>
      <div className="space-y-2 mt-2">
        {[
          ['Template not found',          'Template names are case-sensitive. Use the exact slug from POST /templates.'],
          ['Email without subject',        '"subject" is required for the email channel when not using a template.'],
          ['Invalid phone format',         'SMS "to" must be E.164: +[country][number] — no spaces or dashes.'],
          ['SSE CORS error',               'Do not use withCredentials: true with EventSource. Pass auth via query params.'],
          ['inbox_application_id_fkey',    'Inbox insert failed — the application_id in the notification no longer exists. Check workspace configuration.'],
          ['recipients_key mismatch',      'If your API returns { "data": [...] }, set recipients_key to "data".'],
          ['X-User-ID missing',            'Inbox and SSE endpoints require X-User-ID header (API key auth) or user_id query param (SSE).'],
        ].map(([problem, fix]) => (
          <div key={problem} className="text-xs border border-[var(--border-color)] rounded-[var(--radius)] p-3">
            <div className="font-semibold text-[var(--text-primary)] mb-0.5">{problem}</div>
            <div className="text-[var(--text-muted)]">{fix}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const CONTENT: Record<Section, React.ReactNode> = {
  overview:    <Overview />,
  quickstart:  <QuickStart />,
  auth:        <Auth />,
  users:       <UsersSection />,
  templates:   <Templates />,
  send:        <Send />,
  inbox:       <Inbox />,
  datasources: <Datasources />,
  batch:       <Batch />,
  sse:         <SSE />,
  react:       <ReactIntegration />,
  ai_prompt:   <AIPrompt />,
  errors:      <Errors />,
};

export default function DocsPage() {
  const [active, setActive] = useState<Section>('overview');

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Developer Docs</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Integration reference for the Buzz Notification Service</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* TOC */}
        <Card className="w-52 shrink-0 sticky top-6">
          <CardContent className="p-2">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-[var(--radius)] text-sm text-left transition-colors ${
                  active === id
                    ? 'bg-[var(--accent)] text-white font-medium'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon size={13} className="shrink-0" />
                <span className="truncate">{label}</span>
                {active === id && <ChevronRight size={12} className="ml-auto shrink-0" />}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Content */}
        <Card className="flex-1 min-w-0">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-base">
              {(() => {
                const s = sections.find(s => s.id === active)!;
                const Icon = s.icon;
                return <><Icon size={14} className="text-[var(--accent)]" />{s.label}</>;
              })()}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {CONTENT[active]}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
