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

```txt
- Email: `admin@buzz.local`
- Password: `admin123`
```
