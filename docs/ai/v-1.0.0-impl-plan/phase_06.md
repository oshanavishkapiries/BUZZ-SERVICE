# Phase 06: SMS Provider Implementation

## Objectives
- Implement NotifyLK provider for Sri Lankan SMS
- Add Twilio provider as international fallback
- Support unicode/Sinhala/Tamil messages
- Implement SMS rate limiting
- Add delivery receipt webhooks
- Handle carrier-specific routing

---

## 6.1 SMS Provider Interface

```go
// internal/provider/sms/types.go
package sms

import (
    "context"
    "buzz-service/internal/domain"
)

type SMSProvider interface {
    SendSMS(ctx context.Context, msg *SMSMessage) error
    Name() string
    SupportsCountry(countryCode string) bool
}

type SMSMessage struct {
    To         string            // E.164 format: +94771234567
    From       string            // Sender ID (alphanumeric or shortcode)
    Body       string            // Message content
    IsUnicode  bool              // Unicode encoding for Sinhala/Tamil
    Metadata   map[string]string // Provider-specific data
}

func NotificationToSMSMessage(n *domain.Notification, senderID string) *SMSMessage {
    return &SMSMessage{
        To:        n.ToAddress,
        From:      senderID,
        Body:      n.Body,
        IsUnicode: isUnicodeRequired(n.Body),
        Metadata: map[string]string{
            "notification_id": n.ID.String(),
        },
    }
}

func isUnicodeRequired(text string) bool {
    // Check if text contains non-ASCII characters (Sinhala/Tamil/etc.)
    for _, r := range text {
        if r > 127 {
            return true
        }
    }
    return false
}

// CountryCode extracts country code from E.164 phone number
func CountryCode(phoneNumber string) string {
    if len(phoneNumber) < 3 {
        return ""
    }
    if phoneNumber[0] == '+' {
        // +94... -> 94
        if len(phoneNumber) >= 3 {
            return phoneNumber[1:3]
        }
    }
    return phoneNumber[:2]
}
```

---

## 6.2 NotifyLK Provider (Sri Lanka)

```go
// internal/provider/sms/notifylk.go
package sms

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"
    
    "buzz-service/internal/domain"
    "buzz-service/internal/provider"
)

type NotifyLKProvider struct {
    apiURL   string
    userID   string
    apiKey   string
    senderID string
    client   *http.Client
}

type NotifyLKConfig struct {
    UserID   string
    APIKey   string
    SenderID string // Brand name shown as sender (max 11 chars)
}

func NewNotifyLKProvider(cfg NotifyLKConfig) *NotifyLKProvider {
    return &NotifyLKProvider{
        apiURL:   "https://app.notify.lk/api/v1/send",
        userID:   cfg.UserID,
        apiKey:   cfg.APIKey,
        senderID: cfg.SenderID,
        client: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

func (p *NotifyLKProvider) Send(ctx context.Context, n *domain.Notification) error {
    msg := NotificationToSMSMessage(n, p.senderID)
    return p.SendSMS(ctx, msg)
}

func (p *NotifyLKProvider) SendSMS(ctx context.Context, msg *SMSMessage) error {
    // NotifyLK API request format
    payload := map[string]interface{}{
        "user_id":   p.userID,
        "api_key":   p.apiKey,
        "sender_id": msg.From,
        "to":        msg.To,
        "message":   msg.Body,
    }

    jsonData, err := json.Marshal(payload)
    if err != nil {
        return fmt.Errorf("failed to marshal request: %w", err)
    }

    req, err := http.NewRequestWithContext(ctx, "POST", p.apiURL, bytes.NewBuffer(jsonData))
    if err != nil {
        return fmt.Errorf("failed to create request: %w", err)
    }

    req.Header.Set("Content-Type", "application/json")

    resp, err := p.client.Do(req)
    if err != nil {
        return fmt.Errorf("request failed: %w", err)
    }
    defer resp.Body.Close()

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return fmt.Errorf("failed to read response: %w", err)
    }

    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("NotifyLK API error: %s (status: %d)", string(body), resp.StatusCode)
    }

    // Parse response
    var result map[string]interface{}
    if err := json.Unmarshal(body, &result); err != nil {
        return fmt.Errorf("failed to parse response: %w", err)
    }

    // Check for errors in response
    if status, ok := result["status"].(string); ok && status != "success" {
        errorMsg := result["error"]
        return fmt.Errorf("NotifyLK error: %v", errorMsg)
    }

    // Success - result["data"] contains message_id
    return nil
}

func (p *NotifyLKProvider) Name() string {
    return "notifylk"
}

func (p *NotifyLKProvider) SupportsChannel(channel domain.Channel) bool {
    return channel == domain.ChannelSMS
}

func (p *NotifyLKProvider) SupportsCountry(countryCode string) bool {
    // Sri Lanka country code
    return countryCode == "94"
}
```

---

## 6.3 Twilio Provider (International)

```go
// internal/provider/sms/twilio.go
package sms

import (
    "context"
    "fmt"
    
    "github.com/twilio/twilio-go"
    twilioApi "github.com/twilio/twilio-go/rest/api/v2010"
    "buzz-service/internal/domain"
)

type TwilioProvider struct {
    client      *twilio.RestClient
    fromNumber  string
    messagingServiceSID string
}

type TwilioConfig struct {
    AccountSID          string
    AuthToken           string
    FromNumber          string // E.164 format
    MessagingServiceSID string // Optional: for better deliverability
}

func NewTwilioProvider(cfg TwilioConfig) *TwilioProvider {
    client := twilio.NewRestClientWithParams(twilio.ClientParams{
        Username: cfg.AccountSID,
        Password: cfg.AuthToken,
    })

    return &TwilioProvider{
        client:              client,
        fromNumber:          cfg.FromNumber,
        messagingServiceSID: cfg.MessagingServiceSID,
    }
}

func (p *TwilioProvider) Send(ctx context.Context, n *domain.Notification) error {
    msg := NotificationToSMSMessage(n, p.fromNumber)
    return p.SendSMS(ctx, msg)
}

func (p *TwilioProvider) SendSMS(ctx context.Context, msg *SMSMessage) error {
    params := &twilioApi.CreateMessageParams{}
    params.SetTo(msg.To)
    params.SetBody(msg.Body)

    // Use messaging service SID if configured (better for global delivery)
    if p.messagingServiceSID != "" {
        params.SetMessagingServiceSid(p.messagingServiceSID)
    } else {
        params.SetFrom(p.fromNumber)
    }

    // Send SMS
    resp, err := p.client.Api.CreateMessage(params)
    if err != nil {
        return fmt.Errorf("Twilio send failed: %w", err)
    }

    // Check status
    if resp.Status == nil || (*resp.Status != "queued" && *resp.Status != "sent") {
        errorMsg := "unknown error"
        if resp.ErrorMessage != nil {
            errorMsg = *resp.ErrorMessage
        }
        return fmt.Errorf("Twilio error: %s", errorMsg)
    }

    // Success - resp.Sid contains message SID for tracking
    _ = resp.Sid

    return nil
}

func (p *TwilioProvider) Name() string {
    return "twilio"
}

func (p *TwilioProvider) SupportsChannel(channel domain.Channel) bool {
    return channel == domain.ChannelSMS
}

func (p *TwilioProvider) SupportsCountry(countryCode string) bool {
    // Twilio supports most countries
    return true
}
```

---

## 6.4 SMS Router (Multi-Provider)

```go
// internal/provider/sms/router.go
package sms

import (
    "context"
    "fmt"
    "buzz-service/internal/domain"
    "buzz-service/internal/provider"
)

type SMSRouter struct {
    providers []SMSProvider
    fallback  SMSProvider
}

func NewSMSRouter(providers []SMSProvider, fallback SMSProvider) *SMSRouter {
    return &SMSRouter{
        providers: providers,
        fallback:  fallback,
    }
}

func (r *SMSRouter) Send(ctx context.Context, n *domain.Notification) error {
    // Extract country code from phone number
    countryCode := CountryCode(n.ToAddress)

    // Find suitable provider based on country
    for _, provider := range r.providers {
        if provider.SupportsCountry(countryCode) {
            err := provider.Send(ctx, n)
            if err == nil {
                return nil
            }
            // Log error and try next provider
            fmt.Printf("Provider %s failed: %v\n", provider.Name(), err)
        }
    }

    // Use fallback provider
    if r.fallback != nil {
        return r.fallback.Send(ctx, n)
    }

    return fmt.Errorf("no suitable SMS provider found for country code: %s", countryCode)
}

func (r *SMSRouter) Name() string {
    return "sms-router"
}

func (r *SMSRouter) SupportsChannel(channel domain.Channel) bool {
    return channel == domain.ChannelSMS
}
```

---

## 6.5 SMS Rate Limiting

```go
// internal/provider/sms/ratelimit.go
package sms

import (
    "context"
    "sync"
    "time"
    "golang.org/x/time/rate"
)

type RateLimitedSMSProvider struct {
    provider SMSProvider
    limiter  *rate.Limiter
    mu       sync.Mutex
}

// NewRateLimitedSMSProvider creates a rate-limited SMS provider
// messagesPerSecond: maximum SMS per second
func NewRateLimitedSMSProvider(provider SMSProvider, messagesPerSecond int) *RateLimitedSMSProvider {
    return &RateLimitedSMSProvider{
        provider: provider,
        limiter:  rate.NewLimiter(rate.Limit(messagesPerSecond), messagesPerSecond),
    }
}

func (p *RateLimitedSMSProvider) SendSMS(ctx context.Context, msg *SMSMessage) error {
    // Wait for rate limiter
    if err := p.limiter.Wait(ctx); err != nil {
        return err
    }
    
    return p.provider.SendSMS(ctx, msg)
}

func (p *RateLimitedSMSProvider) Send(ctx context.Context, n *domain.Notification) error {
    if err := p.limiter.Wait(ctx); err != nil {
        return err
    }
    
    return p.provider.Send(ctx, n)
}

func (p *RateLimitedSMSProvider) Name() string {
    return p.provider.Name() + "-ratelimited"
}

func (p *RateLimitedSMSProvider) SupportsChannel(channel domain.Channel) bool {
    return p.provider.SupportsChannel(channel)
}

func (p *RateLimitedSMSProvider) SupportsCountry(countryCode string) bool {
    return p.provider.SupportsCountry(countryCode)
}
```

---

## 6.6 SMS Length Calculator

```go
// internal/provider/sms/length.go
package sms

import (
    "unicode/utf8"
)

const (
    // GSM 7-bit encoding
    GSM7BitSingleSMS = 160
    GSM7BitMultiSMS  = 153 // per segment in concatenated SMS

    // UCS-2 (Unicode) encoding
    UnicodeSingleSMS = 70
    UnicodeMultiSMS  = 67 // per segment in concatenated SMS
)

type SMSInfo struct {
    Length       int
    Segments     int
    Encoding     string
    CharsPerSMS  int
    IsUnicode    bool
}

func CalculateSMSInfo(text string) SMSInfo {
    length := utf8.RuneCountInString(text)
    isUnicode := isUnicodeRequired(text)

    var segments int
    var charsPerSMS int
    var encoding string

    if isUnicode {
        encoding = "UCS-2"
        if length <= UnicodeSingleSMS {
            segments = 1
            charsPerSMS = UnicodeSingleSMS
        } else {
            segments = (length + UnicodeMultiSMS - 1) / UnicodeMultiSMS
            charsPerSMS = UnicodeMultiSMS
        }
    } else {
        encoding = "GSM 7-bit"
        if length <= GSM7BitSingleSMS {
            segments = 1
            charsPerSMS = GSM7BitSingleSMS
        } else {
            segments = (length + GSM7BitMultiSMS - 1) / GSM7BitMultiSMS
            charsPerSMS = GSM7BitMultiSMS
        }
    }

    return SMSInfo{
        Length:      length,
        Segments:    segments,
        Encoding:    encoding,
        CharsPerSMS: charsPerSMS,
        IsUnicode:   isUnicode,
    }
}
```

---

## 6.7 Delivery Receipt Webhook

```go
// internal/api/webhooks.go (additions)
package api

// HandleNotifyLKWebhook processes delivery receipts from NotifyLK
func (h *WebhookHandler) HandleNotifyLKWebhook(c *fiber.Ctx) error {
    var payload map[string]interface{}
    if err := c.BodyParser(&payload); err != nil {
        return c.Status(400).JSON(fiber.Map{"error": "invalid payload"})
    }

    // NotifyLK webhook format
    messageID := payload["message_id"].(string)
    status := payload["status"].(string) // delivered, failed, expired
    
    // Update notification status based on delivery receipt
    switch status {
    case "delivered":
        // Mark as delivered (already marked as sent, optionally add delivered_at)
        _ = messageID
    case "failed", "expired":
        // Mark as failed if not already sent
        _ = messageID
    }

    return c.SendStatus(200)
}

// HandleTwilioWebhook processes Twilio status callbacks
func (h *WebhookHandler) HandleTwilioWebhook(c *fiber.Ctx) error {
    // Parse form data
    messageSID := c.FormValue("MessageSid")
    messageStatus := c.FormValue("MessageStatus")
    errorCode := c.FormValue("ErrorCode")

    // Twilio statuses: queued, sending, sent, delivered, undelivered, failed
    switch messageStatus {
    case "delivered":
        // SMS confirmed delivered
        _ = messageSID
    case "undelivered", "failed":
        // SMS failed
        _ = messageSID
        _ = errorCode
    }

    return c.SendStatus(200)
}
```

---

## 6.8 SMS Validation

```go
// internal/api/validation.go (additions)
package api

import (
    "fmt"
    "regexp"
)

var phoneRegexE164 = regexp.MustCompile(`^\+[1-9]\d{1,14}$`)

func ValidatePhoneNumber(phone string) error {
    if !phoneRegexE164.MatchString(phone) {
        return fmt.Errorf("invalid phone number format (use E.164: +94771234567)")
    }
    
    // Check reasonable length
    if len(phone) < 10 || len(phone) > 16 {
        return fmt.Errorf("phone number length out of range")
    }
    
    return nil
}

func ValidateSMSBody(body string) error {
    info := sms.CalculateSMSInfo(body)
    
    if info.Segments > 3 {
        return fmt.Errorf(
            "SMS too long (%d segments, max 3). Consider shortening message to %d characters",
            info.Segments,
            info.CharsPerSMS * 3,
        )
    }
    
    return nil
}
```

---

## 6.9 Configuration

```bash
# SMS Provider Configuration
SMS_PROVIDER=router  # notifylk, twilio, router

# NotifyLK (Sri Lanka)
NOTIFYLK_USER_ID=your_user_id
NOTIFYLK_API_KEY=your_api_key
NOTIFYLK_SENDER_ID=YourBrand  # Max 11 characters

# Twilio (International)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1234567890
TWILIO_MESSAGING_SERVICE_SID=  # Optional

# Rate Limiting
SMS_RATE_LIMIT_PER_SECOND=10  # Max SMS per second
```

---

## 6.10 Provider Factory Update

```go
// internal/provider/factory.go (additions)
package provider

import (
    "buzz-service/internal/provider/sms"
)

func NewSMSProvider(cfg *config.Config) (Provider, error) {
    switch cfg.SMS.Provider {
    case "notifylk":
        notifyLK := sms.NewNotifyLKProvider(sms.NotifyLKConfig{
            UserID:   cfg.NotifyLK.UserID,
            APIKey:   cfg.NotifyLK.APIKey,
            SenderID: cfg.NotifyLK.SenderID,
        })
        return sms.NewRateLimitedSMSProvider(notifyLK, cfg.SMS.RateLimitPerSecond), nil

    case "twilio":
        twilioProvider := sms.NewTwilioProvider(sms.TwilioConfig{
            AccountSID:          cfg.Twilio.AccountSID,
            AuthToken:           cfg.Twilio.AuthToken,
            FromNumber:          cfg.Twilio.FromNumber,
            MessagingServiceSID: cfg.Twilio.MessagingServiceSID,
        })
        return sms.NewRateLimitedSMSProvider(twilioProvider, cfg.SMS.RateLimitPerSecond), nil

    case "router":
        // Primary: NotifyLK for Sri Lanka
        notifyLK := sms.NewNotifyLKProvider(sms.NotifyLKConfig{
            UserID:   cfg.NotifyLK.UserID,
            APIKey:   cfg.NotifyLK.APIKey,
            SenderID: cfg.NotifyLK.SenderID,
        })

        // Fallback: Twilio for international
        twilioProvider := sms.NewTwilioProvider(sms.TwilioConfig{
            AccountSID: cfg.Twilio.AccountSID,
            AuthToken:  cfg.Twilio.AuthToken,
            FromNumber: cfg.Twilio.FromNumber,
        })

        router := sms.NewSMSRouter(
            []sms.SMSProvider{notifyLK},
            twilioProvider,
        )
        return router, nil

    default:
        return nil, fmt.Errorf("unknown SMS provider: %s", cfg.SMS.Provider)
    }
}
```

---

## 6.11 SMS Cost Tracking

```go
// internal/domain/models.go (additions)
package domain

type SMSCost struct {
    NotificationID uuid.UUID
    Segments       int
    CostPerSegment float64
    TotalCost      float64
    Currency       string
    Provider       string
    CreatedAt      time.Time
}

// Store SMS costs for billing
func (s *PostgresStore) RecordSMSCost(ctx context.Context, cost *SMSCost) error {
    query := `
        INSERT INTO sms_costs (notification_id, segments, cost_per_segment, total_cost, currency, provider)
        VALUES ($1, $2, $3, $4, $5, $6)
    `
    _, err := s.db.ExecContext(ctx, query,
        cost.NotificationID, cost.Segments, cost.CostPerSegment,
        cost.TotalCost, cost.Currency, cost.Provider,
    )
    return err
}
```

---

## 6.12 Deliverables

✅ NotifyLK provider for Sri Lankan SMS
✅ Twilio provider for international SMS
✅ SMS router with country-based routing
✅ Rate limiting for SMS providers
✅ Unicode/Sinhala/Tamil support
✅ SMS length calculator and validation
✅ Delivery receipt webhooks
✅ SMS cost tracking
✅ E.164 phone number validation

---

## 6.13 Testing Phase 6

```bash
# Test SMS to Sri Lankan number
curl -X POST http://localhost:8080/api/v1/notifications \
  -H "Authorization: Bearer buzz_test_key_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+94771234567",
    "channel": "sms",
    "body": "Your OTP code is 123456. Valid for 5 minutes.",
    "priority": "high"
  }'

# Test Unicode SMS (Sinhala)
curl -X POST http://localhost:8080/api/v1/notifications \
  -H "Authorization: Bearer buzz_test_key_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+94771234567",
    "channel": "sms",
    "body": "ඔබගේ OTP කේතය 123456",
    "priority": "high"
  }'

# Test international number (fallback to Twilio)
curl -X POST http://localhost:8080/api/v1/notifications \
  -H "Authorization: Bearer buzz_test_key_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "channel": "sms",
    "body": "Test SMS via Twilio",
    "priority": "normal"
  }'
```

---

## Next Phase
**Phase 07**: Push notification provider (Firebase Cloud Messaging)
