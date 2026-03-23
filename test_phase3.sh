#!/bin/bash

# Phase 3 API Testing Script
# Tests all Phase 3 endpoints

BASE_URL="http://localhost:8080"
API_KEY="buzz_test_key_123"  # Replace with actual test key

echo "=== Buzz Service Phase 3 API Tests ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check (Public)
echo -e "${YELLOW}Test 1: Health Check${NC}"
curl -s -X GET "$BASE_URL/health" | jq .
echo ""

# Test 2: Send Notification - Email with Template
echo -e "${YELLOW}Test 2: Send Email Notification with Template${NC}"
curl -s -X POST "$BASE_URL/api/v1/notifications" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "student@example.com",
    "channel": "email",
    "priority": "normal",
    "template": "welcome_email",
    "data": {
      "student_name": "John Doe",
      "institution_name": "ABC University"
    },
    "recipient_id": "user123",
    "recipient_name": "John Doe"
  }' | jq .
echo ""

# Test 3: Send Notification - SMS without Template
echo -e "${YELLOW}Test 3: Send SMS Notification without Template${NC}"
curl -s -X POST "$BASE_URL/api/v1/notifications" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "channel": "sms",
    "priority": "high",
    "body": "Your OTP is 123456. Valid for 5 minutes.",
    "recipient_id": "user456"
  }' | jq .
echo ""

# Test 4: Send Notification - In-App
echo -e "${YELLOW}Test 4: Send In-App Notification${NC}"
curl -s -X POST "$BASE_URL/api/v1/notifications" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user789",
    "channel": "in_app",
    "priority": "normal",
    "subject": "New Assignment Posted",
    "body": "A new assignment has been posted in your course.",
    "data": {
      "assignment_id": "assign123",
      "course_name": "Computer Science 101"
    }
  }' | jq .
echo ""

# Save notification ID for next test
NOTIF_ID=$(curl -s -X POST "$BASE_URL/api/v1/notifications" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "channel": "email",
    "subject": "Test",
    "body": "Test notification for retrieval"
  }' | jq -r '.id')

echo -e "${GREEN}Created notification ID: $NOTIF_ID${NC}"
echo ""

# Test 5: Get Notification by ID
echo -e "${YELLOW}Test 5: Get Notification by ID${NC}"
curl -s -X GET "$BASE_URL/api/v1/notifications/$NOTIF_ID" \
  -H "Authorization: Bearer $API_KEY" | jq .
echo ""

# Test 6: List Notifications
echo -e "${YELLOW}Test 6: List All Notifications${NC}"
curl -s -X GET "$BASE_URL/api/v1/notifications?limit=5" \
  -H "Authorization: Bearer $API_KEY" | jq .
echo ""

# Test 7: List Notifications with Filters
echo -e "${YELLOW}Test 7: List Notifications (Filtered by Channel)${NC}"
curl -s -X GET "$BASE_URL/api/v1/notifications?channel=email&limit=3" \
  -H "Authorization: Bearer $API_KEY" | jq .
echo ""

# Test 8: Create Template
echo -e "${YELLOW}Test 8: Create Template${NC}"
curl -s -X POST "$BASE_URL/api/v1/templates" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "assignment_reminder",
    "channel": "email",
    "subject": "Assignment Reminder: {{assignment_name}}",
    "body": "Hi {{student_name}},\n\nThis is a reminder that your assignment \"{{assignment_name}}\" is due on {{due_date}}.\n\nBest regards,\n{{institution_name}}",
    "metadata": {
      "category": "academic"
    }
  }' | jq .
echo ""

# Test 9: Get Template
echo -e "${YELLOW}Test 9: Get Template by Name${NC}"
curl -s -X GET "$BASE_URL/api/v1/templates/assignment_reminder" \
  -H "Authorization: Bearer $API_KEY" | jq .
echo ""

# Test 10: List Templates
echo -e "${YELLOW}Test 10: List All Templates${NC}"
curl -s -X GET "$BASE_URL/api/v1/templates" \
  -H "Authorization: Bearer $API_KEY" | jq .
echo ""

# Test 11: Update Template
echo -e "${YELLOW}Test 11: Update Template${NC}"
curl -s -X PATCH "$BASE_URL/api/v1/templates/assignment_reminder" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "UPDATED: Assignment Reminder - {{assignment_name}}",
    "active": true
  }' | jq .
echo ""

# Test 12: Validation Error - Missing Required Field
echo -e "${YELLOW}Test 12: Validation Error - Missing 'to' field${NC}"
curl -s -X POST "$BASE_URL/api/v1/notifications" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "email",
    "subject": "Test",
    "body": "Test"
  }' | jq .
echo ""

# Test 13: Validation Error - Invalid Email
echo -e "${YELLOW}Test 13: Validation Error - Invalid Email Format${NC}"
curl -s -X POST "$BASE_URL/api/v1/notifications" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "not-an-email",
    "channel": "email",
    "subject": "Test",
    "body": "Test"
  }' | jq .
echo ""

# Test 14: Auth Error - Missing API Key
echo -e "${YELLOW}Test 14: Auth Error - Missing API Key${NC}"
curl -s -X GET "$BASE_URL/api/v1/notifications" | jq .
echo ""

# Test 15: Auth Error - Invalid API Key
echo -e "${YELLOW}Test 15: Auth Error - Invalid API Key${NC}"
curl -s -X GET "$BASE_URL/api/v1/notifications" \
  -H "Authorization: Bearer invalid_key" | jq .
echo ""

echo -e "${GREEN}=== All Tests Complete ===${NC}"
