# Phase 3 API Testing Script (PowerShell)
# Tests all Phase 3 endpoints

$BASE_URL = "http://localhost:8080"
$API_KEY = "buzz_test_key_123"  # Replace with actual test key

Write-Host "=== Buzz Service Phase 3 API Tests ===" -ForegroundColor Yellow
Write-Host ""

# Test 1: Health Check (Public)
Write-Host "Test 1: Health Check" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$BASE_URL/health" -Method GET | ConvertTo-Json
Write-Host ""

# Test 2: Send Notification - Email with Template
Write-Host "Test 2: Send Email Notification with Template" -ForegroundColor Cyan
$body = @{
    to = "student@example.com"
    channel = "email"
    priority = "normal"
    template = "welcome_email"
    data = @{
        student_name = "John Doe"
        institution_name = "ABC University"
    }
    recipient_id = "user123"
    recipient_name = "John Doe"
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $API_KEY"
    "Content-Type" = "application/json"
}

try {
    Invoke-RestMethod -Uri "$BASE_URL/api/v1/notifications" -Method POST -Headers $headers -Body $body | ConvertTo-Json
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Send SMS Notification
Write-Host "Test 3: Send SMS Notification" -ForegroundColor Cyan
$body = @{
    to = "+1234567890"
    channel = "sms"
    priority = "high"
    body = "Your OTP is 123456. Valid for 5 minutes."
    recipient_id = "user456"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$BASE_URL/api/v1/notifications" -Method POST -Headers $headers -Body $body | ConvertTo-Json
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 4: List Notifications
Write-Host "Test 4: List All Notifications" -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri "$BASE_URL/api/v1/notifications?limit=5" -Method GET -Headers $headers | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 5: Create Template
Write-Host "Test 5: Create Template" -ForegroundColor Cyan
$body = @{
    name = "test_template_ps"
    channel = "email"
    subject = "Test: {{title}}"
    body = "Hello {{name}}, this is a test."
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$BASE_URL/api/v1/templates" -Method POST -Headers $headers -Body $body | ConvertTo-Json
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 6: List Templates
Write-Host "Test 6: List Templates" -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri "$BASE_URL/api/v1/templates" -Method GET -Headers $headers | ConvertTo-Json -Depth 3
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 7: Validation Error
Write-Host "Test 7: Validation Error - Missing 'to' field" -ForegroundColor Cyan
$body = @{
    channel = "email"
    subject = "Test"
    body = "Test"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$BASE_URL/api/v1/notifications" -Method POST -Headers $headers -Body $body | ConvertTo-Json
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
}
Write-Host ""

# Test 8: Auth Error
Write-Host "Test 8: Auth Error - Missing API Key" -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri "$BASE_URL/api/v1/notifications" -Method GET
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
}
Write-Host ""

Write-Host "=== All Tests Complete ===" -ForegroundColor Green
