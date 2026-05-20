```
 ██████╗ ██╗   ██╗███████╗███████╗
 ██╔══██╗██║   ██║╚══███╔╝╚══███╔╝
 ██████╔╝██║   ██║  ███╔╝   ███╔╝
 ██╔══██╗██║   ██║ ███╔╝   ███╔╝
 ██████╔╝╚██████╔╝███████╗███████╗
 ╚═════╝  ╚═════╝ ╚══════╝╚══════╝

 Buzz Notification Service  |  v1.0.0
```

A unified notification delivery service supporting email, SMS, push, and in-app messaging. Provider credentials are stored in the database — no environment-level secrets per channel.

---

## Quick Start

**1. Start infrastructure**

```bash
docker-compose up -d
```

**2. Start the API server**

```bash
# Install air (first time only)
go install github.com/air-verse/air@latest

air -c .air.toml
```

**3. Start the client app**

```bash
cd client
npm install
npm run dev
```
**4. Login to the dashboard**

The system comes pre-seeded with a default system-wide administrator account:

- **Email**: `admin@buzz.local`
- **Password**: `admin123`

---

## User Roles & Workspace Permissions

Buzz enforces role-based access control (RBAC) to ensure strict workspace isolation:

### System Roles
- **Owner**: System-wide root administrators. They can access **all** application workspaces, create new system-wide user accounts under the **Users** settings page, and delete accounts. Self-registration is disabled for security.
- **User**: Standard user accounts. When created, they have no access to any workspaces until explicitly assigned permissions by a workspace admin or system owner.

### Workspace Permissions
Within an application workspace, members have one of two permission levels:
- **Admin**: Can configure provider integrations, generate new API keys (with easy copy-to-clipboard functionality), and manage other workspace members.
- **Member**: Can view logs and send notifications, but cannot modify settings or manage keys/membership.

### API Key Management
API keys can be generated under the workspace keys settings page. When created:
- The full key is displayed **once** for secure copying.
- Each key is scoped to specific environments (development, staging, production) and API operations (e.g. `notification:send`, `template:write`).