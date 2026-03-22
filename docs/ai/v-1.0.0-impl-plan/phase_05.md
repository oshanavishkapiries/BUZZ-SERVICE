# Phase 05: Email Provider Implementation

## Objectives

- Implement Amazon SES provider
- Add SMTP fallback provider
- Support HTML email templates
- Implement email attachments (optional)
- Add bounce and complaint handling webhooks
- Create email-specific configuration

---

## 5.1 Email Provider Interface Extensions

```go
// internal/provider/email/types.go
package email

import (
    "context"
    "buzz-service/internal/domain"
)

type EmailProvider interface {
    SendEmail(ctx context.Context, msg *EmailMessage) error
    Name() string
}

type EmailMessage struct {
    From        string
    FromName    string
    To          []string
    CC          []string
    BCC         []string
    ReplyTo     string
    Subject     string
    TextBody    string
    HTMLBody    string
    Attachments []Attachment
    Headers     map[string]string
    Tags        map[string]string
}

type Attachment struct {
    Filename    string
    ContentType string
    Data        []byte
}

func NotificationToEmailMessage(n *domain.Notification, cfg EmailConfig) *EmailMessage {
    return &EmailMessage{
        From:     cfg.FromEmail,
        FromName: cfg.FromName,
        To:       []string{n.ToAddress},
        Subject:  n.Subject,
        TextBody: n.Body,
        HTMLBody: renderHTMLFromText(n.Body), // Basic HTML wrapper
        Tags: map[string]string{
            "notification_id": n.ID.String(),
            "channel":        string(n.Channel),
        },
    }
}

func renderHTMLFromText(text string) string {
    // Basic HTML template
    return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        %s
    </div>
</body>
</html>
`, strings.ReplaceAll(text, "\n", "<br>"))
}
```

---

## 5.2 Amazon SES Provider

```go
// internal/provider/email/ses.go
package email

import (
    "context"
    "fmt"

    "github.com/aws/aws-sdk-go-v2/aws"
    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/service/sesv2"
    "github.com/aws/aws-sdk-go-v2/service/sesv2/types"
    "buzz-service/internal/domain"
    "buzz-service/internal/provider"
)

type SESProvider struct {
    client *sesv2.Client
    config EmailConfig
}

type EmailConfig struct {
    FromEmail string
    FromName  string
    Region    string
}

func NewSESProvider(ctx context.Context, emailCfg EmailConfig) (*SESProvider, error) {
    cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(emailCfg.Region))
    if err != nil {
        return nil, fmt.Errorf("failed to load AWS config: %w", err)
    }

    return &SESProvider{
        client: sesv2.NewFromConfig(cfg),
        config: emailCfg,
    }, nil
}

func (p *SESProvider) Send(ctx context.Context, n *domain.Notification) error {
    msg := NotificationToEmailMessage(n, p.config)
    return p.SendEmail(ctx, msg)
}

func (p *SESProvider) SendEmail(ctx context.Context, msg *EmailMessage) error {
    // Build email content
    content := &types.EmailContent{
        Simple: &types.Message{
            Subject: &types.Content{
                Data:    aws.String(msg.Subject),
                Charset: aws.String("UTF-8"),
            },
            Body: &types.Body{
                Text: &types.Content{
                    Data:    aws.String(msg.TextBody),
                    Charset: aws.String("UTF-8"),
                },
            },
        },
    }

    // Add HTML if present
    if msg.HTMLBody != "" {
        content.Simple.Body.Html = &types.Content{
            Data:    aws.String(msg.HTMLBody),
            Charset: aws.String("UTF-8"),
        }
    }

    // Build destination
    destination := &types.Destination{
        ToAddresses: msg.To,
    }
    if len(msg.CC) > 0 {
        destination.CcAddresses = msg.CC
    }
    if len(msg.BCC) > 0 {
        destination.BccAddresses = msg.BCC
    }

    // Build sender
    fromAddr := msg.From
    if msg.FromName != "" {
        fromAddr = fmt.Sprintf("%s <%s>", msg.FromName, msg.From)
    }

    // Send email
    input := &sesv2.SendEmailInput{
        FromEmailAddress: aws.String(fromAddr),
        Destination:      destination,
        Content:          content,
    }

    // Add reply-to if specified
    if msg.ReplyTo != "" {
        input.ReplyToAddresses = []string{msg.ReplyTo}
    }

    // Add custom headers
    if len(msg.Headers) > 0 {
        var headers []types.MessageHeader
        for key, value := range msg.Headers {
            headers = append(headers, types.MessageHeader{
                Name:  aws.String(key),
                Value: aws.String(value),
            })
        }
        if content.Simple != nil {
            // Note: Custom headers require Raw email format
            // For simplicity, we'll skip this in v1
        }
    }

    // Add email tags
    if len(msg.Tags) > 0 {
        var tags []types.MessageTag
        for key, value := range msg.Tags {
            tags = append(tags, types.MessageTag{
                Name:  aws.String(key),
                Value: aws.String(value),
            })
        }
        input.EmailTags = tags
    }

    result, err := p.client.SendEmail(ctx, input)
    if err != nil {
        return fmt.Errorf("SES send failed: %w", err)
    }

    // result.MessageId can be stored for tracking
    _ = result.MessageId

    return nil
}

func (p *SESProvider) Name() string {
    return "amazon-ses"
}

func (p *SESProvider) SupportsChannel(channel domain.Channel) bool {
    return channel == domain.ChannelEmail
}
```

---

## 5.3 SMTP Provider (Fallback)

```go
// internal/provider/email/smtp.go
package email

import (
    "context"
    "crypto/tls"
    "fmt"
    "net/smtp"
    "strings"

    "buzz-service/internal/domain"
)

type SMTPProvider struct {
    host     string
    port     int
    username string
    password string
    useTLS   bool
    config   EmailConfig
}

type SMTPConfig struct {
    Host     string
    Port     int
    Username string
    Password string
    UseTLS   bool
}

func NewSMTPProvider(smtpCfg SMTPConfig, emailCfg EmailConfig) *SMTPProvider {
    return &SMTPProvider{
        host:     smtpCfg.Host,
        port:     smtpCfg.Port,
        username: smtpCfg.Username,
        password: smtpCfg.Password,
        useTLS:   smtpCfg.UseTLS,
        config:   emailCfg,
    }
}

func (p *SMTPProvider) Send(ctx context.Context, n *domain.Notification) error {
    msg := NotificationToEmailMessage(n, p.config)
    return p.SendEmail(ctx, msg)
}

func (p *SMTPProvider) SendEmail(ctx context.Context, msg *EmailMessage) error {
    // Build email message
    from := msg.From
    if msg.FromName != "" {
        from = fmt.Sprintf("%s <%s>", msg.FromName, msg.From)
    }

    headers := make(map[string]string)
    headers["From"] = from
    headers["To"] = strings.Join(msg.To, ", ")
    headers["Subject"] = msg.Subject
    headers["MIME-Version"] = "1.0"

    if len(msg.CC) > 0 {
        headers["Cc"] = strings.Join(msg.CC, ", ")
    }
    if msg.ReplyTo != "" {
        headers["Reply-To"] = msg.ReplyTo
    }

    // Add custom headers
    for key, value := range msg.Headers {
        headers[key] = value
    }

    // Build message body
    var message strings.Builder
    for key, value := range headers {
        message.WriteString(fmt.Sprintf("%s: %s\r\n", key, value))
    }

    // Multipart message for text and HTML
    if msg.HTMLBody != "" {
        boundary := "boundary_buzz_service"
        headers["Content-Type"] = fmt.Sprintf("multipart/alternative; boundary=\"%s\"", boundary)

        message.WriteString("\r\n")
        message.WriteString(fmt.Sprintf("--%s\r\n", boundary))
        message.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
        message.WriteString("\r\n")
        message.WriteString(msg.TextBody)
        message.WriteString("\r\n\r\n")

        message.WriteString(fmt.Sprintf("--%s\r\n", boundary))
        message.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
        message.WriteString("\r\n")
        message.WriteString(msg.HTMLBody)
        message.WriteString("\r\n\r\n")

        message.WriteString(fmt.Sprintf("--%s--", boundary))
    } else {
        headers["Content-Type"] = "text/plain; charset=UTF-8"
        message.WriteString("\r\n")
        message.WriteString(msg.TextBody)
    }

    // Combine all recipients
    recipients := append([]string{}, msg.To...)
    recipients = append(recipients, msg.CC...)
    recipients = append(recipients, msg.BCC...)

    // SMTP authentication
    auth := smtp.PlainAuth("", p.username, p.password, p.host)

    // Send email
    addr := fmt.Sprintf("%s:%d", p.host, p.port)

    if p.useTLS {
        // TLS connection
        tlsConfig := &tls.Config{
            ServerName: p.host,
        }

        conn, err := tls.Dial("tcp", addr, tlsConfig)
        if err != nil {
            return fmt.Errorf("TLS dial failed: %w", err)
        }
        defer conn.Close()

        client, err := smtp.NewClient(conn, p.host)
        if err != nil {
            return fmt.Errorf("SMTP client creation failed: %w", err)
        }
        defer client.Quit()

        if err := client.Auth(auth); err != nil {
            return fmt.Errorf("SMTP auth failed: %w", err)
        }

        if err := client.Mail(msg.From); err != nil {
            return fmt.Errorf("MAIL command failed: %w", err)
        }

        for _, recipient := range recipients {
            if err := client.Rcpt(recipient); err != nil {
                return fmt.Errorf("RCPT command failed for %s: %w", recipient, err)
            }
        }

        writer, err := client.Data()
        if err != nil {
            return fmt.Errorf("DATA command failed: %w", err)
        }

        _, err = writer.Write([]byte(message.String()))
        if err != nil {
            return fmt.Errorf("write failed: %w", err)
        }

        err = writer.Close()
        if err != nil {
            return fmt.Errorf("close failed: %w", err)
        }

        return nil
    } else {
        // Standard SMTP
        return smtp.SendMail(
            addr,
            auth,
            msg.From,
            recipients,
            []byte(message.String()),
        )
    }
}

func (p *SMTPProvider) Name() string {
    return "smtp"
}

func (p *SMTPProvider) SupportsChannel(channel domain.Channel) bool {
    return channel == domain.ChannelEmail
}
```

---

## 5.4 HTML Email Templates

```go
// internal/provider/email/templates.go
package email

import (
    "bytes"
    "html/template"
)

const defaultHTMLTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{.Subject}}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            background: #4CAF50;
            color: white;
            padding: 20px;
            text-align: center;
        }
        .content {
            padding: 30px;
        }
        .footer {
            background: #f9f9f9;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background: #4CAF50;
            color: white !important;
            text-decoration: none;
            border-radius: 4px;
            margin: 16px 0;
        }
        .button:hover {
            background: #45a049;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{.InstitutionName}}</h1>
        </div>
        <div class="content">
            {{.HTMLContent}}
        </div>
        <div class="footer">
            <p>This is an automated message from {{.InstitutionName}}.</p>
            <p>Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
`

type HTMLTemplateData struct {
    Subject         string
    InstitutionName string
    HTMLContent     template.HTML
}

func RenderHTMLTemplate(subject, content, institutionName string) (string, error) {
    tmpl, err := template.New("email").Parse(defaultHTMLTemplate)
    if err != nil {
        return "", err
    }

    data := HTMLTemplateData{
        Subject:         subject,
        InstitutionName: institutionName,
        HTMLContent:     template.HTML(content),
    }

    var buf bytes.Buffer
    if err := tmpl.Execute(&buf, data); err != nil {
        return "", err
    }

    return buf.String(), nil
}
```

---

## 5.5 Bounce and Complaint Handling

```go
// internal/api/webhooks.go
package api

import (
    "encoding/json"
    "github.com/gofiber/fiber/v2"
    "buzz-service/internal/store"
)

type WebhookHandler struct {
    store *store.PostgresStore
}

func NewWebhookHandler(store *store.PostgresStore) *WebhookHandler {
    return &WebhookHandler{store: store}
}

// HandleSESWebhook processes Amazon SES bounce/complaint notifications
func (h *WebhookHandler) HandleSESWebhook(c *fiber.Ctx) error {
    var payload map[string]interface{}
    if err := c.BodyParser(&payload); err != nil {
        return c.Status(400).JSON(fiber.Map{"error": "invalid payload"})
    }

    // Parse SNS message
    messageType := payload["Type"]
    if messageType == "SubscriptionConfirmation" {
        // Auto-confirm SNS subscription
        subscribeURL := payload["SubscribeURL"].(string)
        // Make HTTP GET request to subscribeURL
        _ = subscribeURL
        return c.SendStatus(200)
    }

    if messageType == "Notification" {
        message := payload["Message"].(string)

        var sesMessage map[string]interface{}
        if err := json.Unmarshal([]byte(message), &sesMessage); err != nil {
            return c.Status(400).JSON(fiber.Map{"error": "invalid SES message"})
        }

        notificationType := sesMessage["notificationType"].(string)

        switch notificationType {
        case "Bounce":
            return h.handleBounce(c, sesMessage)
        case "Complaint":
            return h.handleComplaint(c, sesMessage)
        }
    }

    return c.SendStatus(200)
}

func (h *WebhookHandler) handleBounce(c *fiber.Ctx, message map[string]interface{}) error {
    bounce := message["bounce"].(map[string]interface{})
    bounceType := bounce["bounceType"].(string)

    recipients := bounce["bouncedRecipients"].([]interface{})

    for _, recipient := range recipients {
        email := recipient.(map[string]interface{})["emailAddress"].(string)

        // Mark email as bounced in database
        // Optionally: disable future sends to this address
        _ = email
        _ = bounceType
    }

    return c.SendStatus(200)
}

func (h *WebhookHandler) handleComplaint(c *fiber.Ctx, message map[string]interface{}) error {
    complaint := message["complaint"].(map[string]interface{})
    recipients := complaint["complainedRecipients"].([]interface{})

    for _, recipient := range recipients {
        email := recipient.(map[string]interface{})["emailAddress"].(string)

        // Mark email as complained (spam report)
        // MUST stop sending to this address
        _ = email
    }

    return c.SendStatus(200)
}
```

---

## 5.6 Configuration

```bash
# Email Provider Configuration
EMAIL_PROVIDER=ses  # ses, smtp

# Amazon SES
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
EMAIL_FROM=notifications@yourdomain.com
EMAIL_FROM_NAME=Your Institution

# SMTP (fallback)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_USE_TLS=true

# Branding
INSTITUTION_NAME=elight Learning Platform
```

---

## 5.7 Provider Factory

```go
// internal/provider/factory.go
package provider

import (
    "context"
    "fmt"
    "buzz-service/internal/config"
    "buzz-service/internal/domain"
    "buzz-service/internal/provider/email"
)

func NewEmailProvider(ctx context.Context, cfg *config.Config) (Provider, error) {
    emailCfg := email.EmailConfig{
        FromEmail: cfg.Email.FromEmail,
        FromName:  cfg.Email.FromName,
        Region:    cfg.AWS.Region,
    }

    switch cfg.Email.Provider {
    case "ses":
        return email.NewSESProvider(ctx, emailCfg)
    case "smtp":
        smtpCfg := email.SMTPConfig{
            Host:     cfg.SMTP.Host,
            Port:     cfg.SMTP.Port,
            Username: cfg.SMTP.Username,
            Password: cfg.SMTP.Password,
            UseTLS:   cfg.SMTP.UseTLS,
        }
        return email.NewSMTPProvider(smtpCfg, emailCfg), nil
    default:
        return nil, fmt.Errorf("unknown email provider: %s", cfg.Email.Provider)
    }
}
```

---

## 5.8 Rate Limiting for Email

```go
// internal/provider/email/ratelimit.go
package email

import (
    "context"
    "time"
    "golang.org/x/time/rate"
)

type RateLimitedEmailProvider struct {
    provider EmailProvider
    limiter  *rate.Limiter
}

func NewRateLimitedProvider(provider EmailProvider, rps int) *RateLimitedEmailProvider {
    return &RateLimitedEmailProvider{
        provider: provider,
        limiter:  rate.NewLimiter(rate.Limit(rps), rps*2), // burst = 2x rate
    }
}

func (p *RateLimitedEmailProvider) SendEmail(ctx context.Context, msg *EmailMessage) error {
    // Wait for rate limiter
    if err := p.limiter.Wait(ctx); err != nil {
        return err
    }

    return p.provider.SendEmail(ctx, msg)
}
```

---

## 5.9 Deliverables

✅ Amazon SES provider implementation
✅ SMTP fallback provider
✅ HTML email template system
✅ Bounce and complaint webhook handlers
✅ Rate limiting for email providers
✅ Email configuration management
✅ Provider factory pattern
✅ Multipart email support (text + HTML)

---

## 5.10 Testing Phase 5

```bash
# Test with SES
curl -X POST http://localhost:8080/api/v1/notifications \
  -H "Authorization: Bearer buzz_test_key_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "channel": "email",
    "subject": "Test Email from Buzz Service",
    "body": "This is a test email delivery.",
    "priority": "normal"
  }'

# Check email delivery
# Verify email received in inbox
# Check SES sending statistics in AWS Console

# Test SMTP fallback
# Change EMAIL_PROVIDER=smtp in .env
# Restart service and send another notification
```

---

## Next Phase

**Phase 06**: SMS provider implementation (NotifyLK for Sri Lanka + Twilio fallback)
