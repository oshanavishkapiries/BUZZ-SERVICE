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

**3. Build and serve the client app**

The client application is statically exported and natively hosted by the Go API server at the root `/` route. You just need to build the frontend first:

```bash
cd client
npm install
npm run build
cd ..
```
Now, navigate to `http://localhost:8080/` in your browser. The client automatically determines the API base URL from the domain it is served on.
**4. Login to the dashboard**

The system comes pre-seeded with a default system-wide administrator account:

```txt
- Email: `admin@buzz.local`
- Password: `admin123`
```
