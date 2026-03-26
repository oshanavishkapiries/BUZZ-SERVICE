#!/bin/bash
# Send a single email notification

curl -X POST http://localhost:8080/api/v1/notifications \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "email",
    "priority": "normal",
    "recipient": {
      "email": "user@example.com",
      "name": "John Doe"
    },
    "subject": "Welcome to Buzz Service",
    "body": "Thank you for signing up!",
    "max_retries": 3
  }'

echo ""
echo "---"
echo ""

# Send a bulk email notification
curl -X POST http://localhost:8080/api/v1/batches/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "datasource_name": "crm_database",
    "endpoint_name": "active_users",
    "endpoint_params": {
      "status": "active",
      "region": "us"
    },
    "template_name": "weekly_digest",
    "template_data": {
      "week_number": 12,
      "year": 2026
    },
    "channel": "email",
    "priority": "normal",
    "idempotency_key": "weekly-digest-2026-w12"
  }'

echo ""
echo "---"
echo ""

# Get batch status
BATCH_ID="550e8400-e29b-41d4-a716-446655440000"
curl -X GET "http://localhost:8080/api/v1/batches/$BATCH_ID" \
  -H "Authorization: Bearer YOUR_API_KEY"

echo ""
echo "---"
echo ""

# List inbox notifications
curl -X GET "http://localhost:8080/api/v1/inbox?limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_API_KEY"
