# Buzz Notification Service (v1.0.0)
Unified multi-channel notification delivery service supporting email, SMS, push notifications, and in-app messaging.

## Documentation

- **[OpenAPI Specification](./docs/openapi.yaml)** - Complete API documentation in OpenAPI 3.0.3 format
  - View with [Swagger UI](https://editor.swagger.io/?url=https://raw.githubusercontent.com/yourgithub/buzz-service/main/docs/openapi.yaml)
  - View with [Redoc](https://redocly.github.io/redoc/?url=https://raw.githubusercontent.com/yourgithub/buzz-service/main/docs/openapi.yaml)

- **[Integration Examples](./docs/examples/)**
  - [cURL examples](./docs/examples/curl-examples.sh)
  - [Python examples](./docs/examples/python-examples.py)
  - [JavaScript examples](./docs/examples/javascript-examples.js)

## Features

- **Multi-channel delivery** - Email, SMS, push notifications, and in-app messaging
- **Bulk notifications** - Send to multiple recipients via external datasources with progress tracking
- **Real-time delivery** - Server-Sent Events (SSE) for instant in-app notifications
- **Template management** - Create and reuse notification templates with variable substitution
- **Delivery tracking** - Monitor notification status and delivery analytics
- **Queue monitoring** - Real-time queue statistics and performance monitoring
- **Request deduplication** - Idempotency keys for reliable bulk operations
