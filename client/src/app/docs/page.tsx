'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen, Bell, Database, Layers, Key, Wifi,
  FileText, ChevronRight, Terminal, AlertCircle,
} from 'lucide-react';

type Section =
  | 'overview'
  | 'auth'
  | 'templates'
  | 'send'
  | 'datasources'
  | 'batch'
  | 'sse'
  | 'errors';

const sections: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'overview',    label: 'Overview',            icon: BookOpen  },
  { id: 'auth',        label: 'Authentication',      icon: Key       },
  { id: 'templates',   label: 'Templates',           icon: FileText  },
  { id: 'send',        label: 'Sending Notifications', icon: Bell    },
  { id: 'datasources', label: 'Registering Datasources', icon: Database },
  { id: 'batch',       label: 'Batch Notifications', icon: Layers    },
  { id: 'sse',         label: 'Real-time (SSE)',      icon: Wifi      },
  { id: 'errors',      label: 'Error Reference',     icon: AlertCircle },
];

function Code({ children, lang = 'json' }: { children: string; lang?: string }) {
  return (
    <pre className={`language-${lang} text-xs font-mono bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-[var(--radius)] p-4 overflow-x-auto whitespace-pre leading-relaxed text-[var(--text-secondary)] my-3`}>
      {children.trim()}
    </pre>
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
        Buzz is a standalone microservice that handles all notification delivery for your platform.
        It supports four channels — <strong>email</strong>, <strong>SMS</strong>, <strong>push</strong>, and <strong>in-app</strong> —
        through a single REST API. Your application never calls SendGrid, Twilio, or FCM directly; it calls Buzz.
      </P>
      <H2>Architecture</H2>
      <Code lang="text">{`
Your backend  ──POST /api/v1/notifications──►  Buzz Service  ──►  SendGrid / Twilio / FCM
                                                     │
                                                     ▼
                                               PostgreSQL + Redis
                                                     │
                                                     ▼ SSE
Your frontend  ◄────── real-time inbox push ─────── Buzz Service
`}</Code>
      <P>
        Buzz stores every notification in Postgres and queues delivery through Redis. It is stateless beyond the
        database — you can run multiple instances behind a load balancer.
      </P>
      <H2>Concepts</H2>
      <div className="space-y-2 mt-2">
        {[
          ['API Key',      'A bearer token scoped to specific operations (read/write/send). Create these in your admin.'],
          ['Template',     'A reusable message definition with {{variable}} placeholders for dynamic content.'],
          ['Datasource',   'A registered external API endpoint (e.g. your master backend) that Buzz calls to fetch recipient lists for batch jobs.'],
          ['Batch',        'A fan-out job: fetch recipients from a datasource → render template for each → send notifications.'],
          ['SSE Stream',   'A persistent HTTP connection that pushes events to connected clients in real time.'],
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

function Auth() {
  return (
    <div>
      <P>All API endpoints (except <code>/health</code>) require a Bearer token in the <code>Authorization</code> header.</P>
      <Code lang="http">{`
Authorization: Bearer bz_live_xxxxxxxxxxxxxxxxxxxx
`}</Code>
      <P>In-app and inbox endpoints also require a <code>X-User-ID</code> header to identify whose inbox to read or write.</P>
      <Code lang="http">{`
X-User-ID: user_123
`}</Code>
      <H2>Scopes</H2>
      <P>Each API key is issued with one or more scopes. Calling an endpoint without the matching scope returns <code>403</code>.</P>
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
        ].map(([scope, desc]) => (
          <div key={scope} className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-color)] last:border-0">
            <code className="font-mono text-xs text-[var(--accent)] w-44 shrink-0">{scope}</code>
            <span className="text-xs text-[var(--text-secondary)]">{desc}</span>
          </div>
        ))}
      </div>
      <Callout type="info">
        For development, create a key with all scopes. In production, issue narrowly-scoped keys per service.
      </Callout>
    </div>
  );
}

function Templates() {
  return (
    <div>
      <P>
        Templates let you define a message once and reuse it across many notifications. Variables are written as
        <code className="font-mono text-xs mx-1 px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)]">{`{{variable_name}}`}</code>
        in the subject and body — Buzz substitutes them at send time.
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
        <Field name="name"      type="string"   req  desc="Unique slug used when referencing this template in send requests. Lowercase, underscores." />
        <Field name="channels"  type="string[]" req  desc="Array of channels this template supports: email, sms, push, in_app." />
        <Field name="subject"   type="string"       desc="Email subject line. Required when channels includes email. Supports {{variables}}." />
        <Field name="body"      type="string"   req  desc="Message body. Supports {{variables}} placeholders." />
        <Field name="variables" type="string[]"     desc="Optional list of expected variable names. Buzz auto-detects {{vars}} from body/subject, so this field is optional — use it to declare variables that appear in default_values only." />
      </div>
      <H3>Multi-channel templates</H3>
      <P>
        A single template can cover multiple channels. When sending, specify which channel to use —
        Buzz picks the right subject/body and validates that the channel is in the template's list.
      </P>
      <Callout type="tip">
        Email requires a <code>subject</code>. SMS and push do not. If a template is for both email and SMS,
        include a subject — it will be ignored for non-email channels.
      </Callout>
      <H2>Endpoints</H2>
      <Endpoint method="GET"    path="/api/v1/templates"        desc="List all templates (paginated)" />
      <Endpoint method="GET"    path="/api/v1/templates/:name"  desc="Get a single template" />
      <Endpoint method="PATCH"  path="/api/v1/templates/:name"  desc="Update subject, body, or active status" />
      <Endpoint method="DELETE" path="/api/v1/templates/:name"  desc="Soft-delete a template" />
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
      <P>Pass the template name and a <code>data</code> object whose keys match the template's variables.</P>
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
        For in-app, <code>to</code> is the user's ID (not an email). The message lands in the user's inbox.
        Set <code>X-User-ID</code> to the same value to read it back.
      </P>
      <Code>{`
{
  "to": "user_123",
  "channel": "in_app",
  "template": "welcome_email",
  "data": { "name": "Alice", "company": "Acme Corp" }
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
        <Field name="recipient_id"    type="string"      desc="Optional logical user ID — stored on the notification and used to route SSE invalidation." />
        <Field name="idempotency_key" type="string"      desc="If provided, Buzz deduplicates: a second request with the same key returns the original notification." />
        <Field name="scheduled_for"   type="ISO8601"     desc="Future timestamp to schedule delivery. Omit for immediate delivery." />
      </div>

      <H2>Priority</H2>
      <P>
        Priority controls queue ordering, not channel speed. <code>urgent</code> jumps ahead of pending
        <code>normal</code> messages. All messages are eventually delivered.
      </P>
    </div>
  );
}

function Datasources() {
  return (
    <div>
      <P>
        A <strong>Datasource</strong> is a registration that tells Buzz how to call your master backend to
        fetch a recipient list. You register it once; batch jobs reference it by name.
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

      <H2>Endpoint config fields</H2>
      <div className="border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden">
        <Field name="path"             type="string" req  desc="URL path appended to base_url. Supports path params: /users/{segment}." />
        <Field name="method"           type="string"     desc="HTTP method. Default: GET." />
        <Field name="pagination_style" type="string"     desc='"offset" (default) — sends offset=N&limit=100. "page" — sends page=N&per_page=100.' />
        <Field name="response_format"  type="object" req  desc="Describes how to read the response. See below." />
      </div>

      <H3>response_format fields</H3>
      <div className="border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden">
        <Field name="recipients_key"     type="string" req  desc='Key in the JSON response that holds the array of users. Example: "users" if response is {"users": [...]}.' />
        <Field name="email_field"        type="string"     desc='Field name in each user object that holds the email. Default: "email".' />
        <Field name="name_field"         type="string"     desc='Field name for the display name. Default: "name".' />
        <Field name="phone_field"        type="string"     desc='Field name for phone number (E.164). Default: "phone".' />
        <Field name="device_token_field" type="string"     desc='Field name for push device token. Omit if not sending push.' />
      </div>

      <H2>What your master backend must return</H2>
      <P>
        Buzz pages through your endpoint by incrementing <code>offset</code> until it gets an empty array.
        Your endpoint receives the pagination params as query params:
      </P>
      <Code lang="http">{`
GET /internal/users/active?offset=0&limit=100
GET /internal/users/active?offset=100&limit=100
GET /internal/users/active?offset=200&limit=100
...
`}</Code>
      <P>Each response must be a JSON object containing the <code>recipients_key</code> array:</P>
      <Code>{`
{
  "users": [
    { "id": "usr_1", "email": "alice@example.com", "full_name": "Alice",  "phone_number": "+1234567890" },
    { "id": "usr_2", "email": "bob@example.com",   "full_name": "Bob",    "phone_number": "+1987654321" }
  ]
}
`}</Code>
      <P>
        When Buzz receives an empty array (or fewer than 100 items), it stops paginating and proceeds to
        fan out notifications.
      </P>

      <H2>Authentication types</H2>
      <div className="border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden">
        <Field name="bearer"  type="auth_type" desc='auth_config: { "token": "..." } — adds Authorization: Bearer <token>' />
        <Field name="basic"   type="auth_type" desc='auth_config: { "username": "...", "password": "..." } — HTTP Basic auth' />
        <Field name="api_key" type="auth_type" desc='auth_config: { "header": "X-API-Key", "key": "..." } — custom header' />
        <Field name="(empty)" type="auth_type" desc='No authentication — open endpoint' />
      </div>

      <H2>Other endpoints</H2>
      <Endpoint method="GET"    path="/api/v1/datasources"     desc="List all registered datasources" />
      <Endpoint method="GET"    path="/api/v1/datasources/:id" desc="Get datasource by ID" />
      <Endpoint method="PATCH"  path="/api/v1/datasources/:id" desc="Update base_url, auth, or endpoints" />
      <Endpoint method="DELETE" path="/api/v1/datasources/:id" desc="Deactivate (soft delete)" />

      <Callout type="warn">
        <code>auth_config</code> stores credentials in plaintext in the database. For production, restrict
        database access and consider using environment variables in the Buzz config instead.
      </Callout>
    </div>
  );
}

function Batch() {
  return (
    <div>
      <P>
        A batch job fetches all recipients from a datasource endpoint, renders a template for each one, and
        queues individual notifications. This is how you send to 10,000 users without 10,000 API calls.
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
  "endpoint_params":  { "segment": "premium" },
  "template_name":    "welcome_email",
  "template_data":    { "company": "Acme Corp" },
  "channel":          "email",
  "priority":         "normal",
  "idempotency_key":  "campaign_2024_q1_welcome"
}
`}</Code>

      <div className="border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden mt-2">
        <Field name="datasource_name"  type="string" req  desc="Name you used when registering the datasource." />
        <Field name="endpoint_name"    type="string" req  desc="Key inside the datasource's endpoints object." />
        <Field name="endpoint_params"  type="object"     desc="Extra query or path params forwarded to your endpoint." />
        <Field name="template_name"    type="string" req  desc="Template name to render for each recipient." />
        <Field name="template_data"    type="object"     desc="Static variables merged with each recipient's fields before rendering." />
        <Field name="channel"          type="string" req  desc="email | sms | push | in_app" />
        <Field name="priority"         type="string"     desc="low | normal | high | urgent" />
        <Field name="idempotency_key"  type="string"     desc="Unique key per campaign. A duplicate request with the same key returns the original batch instead of creating a new one." />
      </div>

      <H3>How template_data merges with recipient data</H3>
      <P>
        Buzz merges <code>template_data</code> (static, from the batch request) with each recipient's fields
        (dynamic, from your API). Recipient fields win on conflict, so per-person values always override
        campaign-wide values.
      </P>
      <Code lang="text">{`
Final variables = template_data + recipient fields (recipient wins)

Example:
  template_data:  { "company": "Acme",  "name": "User"    }
  recipient:      { "email":   "...",   "name": "Alice"   }
  result:         { "company": "Acme",  "name": "Alice"   }
                                                ↑ overridden
`}</Code>

      <H2>Batch statuses</H2>
      <div className="border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden mt-2">
        {[
          ['pending',    'Job created, waiting in queue'],
          ['fetching',   'Calling your datasource endpoint to collect recipients'],
          ['queued',     'All recipients collected, about to start delivering'],
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

      <H2>Check batch progress</H2>
      <Endpoint method="GET" path="/api/v1/batches/:id" desc="Get status and counts" />
      <Code>{`
{
  "batch_id":    "550e8400-...",
  "status":      "delivering",
  "total":       4820,
  "sent":        1340,
  "failed":      3,
  "skipped":     0
}
`}</Code>

      <Callout type="tip">
        Use <code>idempotency_key</code> to safely retry your batch submission — Buzz will return
        the existing batch instead of creating a duplicate.
      </Callout>
    </div>
  );
}

function SSE() {
  return (
    <div>
      <P>
        Buzz pushes events to connected clients via Server-Sent Events (SSE). The intended use is
        real-time inbox invalidation: your frontend connects once on login and stays connected.
        When a notification arrives, Buzz sends an event and your client re-fetches the inbox.
      </P>

      <H2>Connect</H2>
      <Endpoint method="GET" path="/api/v1/stream" desc="Open SSE connection" />
      <P>
        Pass credentials as query params (EventSource doesn't support custom headers):
      </P>
      <Code lang="js">{`
const es = new EventSource(
  \`\${API_URL}/api/v1/stream\` +
  \`?Authorization=Bearer%20\${encodeURIComponent(API_KEY)}\` +
  \`&X-User-ID=\${encodeURIComponent(USER_ID)}\`
);
`}</Code>

      <H2>Events</H2>
      <div className="border border-[var(--border-color)] rounded-[var(--radius)] overflow-hidden mt-2">
        {[
          ['connected',    'Fired immediately on successful connection. Contains { status, time }.'],
          ['notification', 'Fired when an event is published for this user. Currently carries { type, time }. Payload type "inbox_update" means re-fetch the inbox.'],
        ].map(([event, desc]) => (
          <div key={event} className="flex items-start gap-3 px-4 py-2.5 border-b border-[var(--border-color)] last:border-0">
            <code className="font-mono text-xs text-[var(--accent)] w-24 shrink-0 pt-0.5">{event}</code>
            <span className="text-xs text-[var(--text-secondary)]">{desc}</span>
          </div>
        ))}
      </div>

      <H2>Inbox invalidation pattern</H2>
      <Code lang="js">{`
// 1. Load inbox on page mount
const inbox = await fetch('/api/v1/inbox', { headers: authHeaders });

// 2. Open SSE — stays open for the session
const es = new EventSource(sseUrl);

es.addEventListener('notification', (ev) => {
  const { type } = JSON.parse(ev.data);
  if (type === 'inbox_update') {
    // 3. Re-fetch inbox instead of updating local state manually
    refetchInbox();
  }
});
`}</Code>

      <P>
        This pattern keeps your inbox state authoritative from the server. You never have to merge
        partial updates on the client side.
      </P>

      <H2>Online user count</H2>
      <P>
        Every active SSE connection is counted. Use this to measure concurrent users.
      </P>
      <Endpoint method="GET" path="/api/v1/stream/stats" desc="Get online user count" />
      <Code>{`
{ "online_users": 142, "total_connections": 156 }
`}</Code>
      <P>
        <code>online_users</code> is unique user IDs. <code>total_connections</code> counts each browser tab separately.
      </P>

      <H2>Reconnection</H2>
      <P>
        The browser reconnects automatically. Buzz sends a heartbeat ping every 30 seconds to keep the
        connection alive through proxies and firewalls.
      </P>
      <Callout type="warn">
        SSE connections count against your server's open file descriptor limit.
        For more than ~1,000 concurrent users consider running multiple Buzz instances behind a load balancer
        with Redis Pub/Sub as the fanout bus (already wired — just scale horizontally).
      </Callout>
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
          ['202', 'Accepted — notification / batch queued'],
          ['400', 'Bad request — missing field, invalid format, or validation error'],
          ['401', 'Unauthorized — missing or invalid API key'],
          ['403', 'Forbidden — API key lacks the required scope'],
          ['404', 'Not found — resource does not exist'],
          ['500', 'Internal error — check service logs'],
          ['503', 'Service unavailable — database down'],
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
          ['Template not found on send',   'Template names are case-sensitive. Use the exact name from POST /templates.'],
          ['Email without subject',         '"subject" is required for email channel when not using a template.'],
          ['Invalid phone format',          'SMS "to" must be E.164: +[country][number] — no spaces or dashes.'],
          ['Datasource 404 on batch send',  'datasource_name must match exactly the name used in POST /datasources.'],
          ['endpoint_name not found',       'Must match a key inside the datasource\'s endpoints object.'],
          ['recipients_key mismatch',       'If your API returns { "data": [...] }, set recipients_key to "data".'],
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
  auth:        <Auth />,
  templates:   <Templates />,
  send:        <Send />,
  datasources: <Datasources />,
  batch:       <Batch />,
  sse:         <SSE />,
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
