package email

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/elight/buzz-service/internal/domain"
)

// EmailProvider defines the interface for email delivery
type EmailProvider interface {
	SendEmail(ctx context.Context, msg *EmailMessage) error
	Name() string
	SupportsChannel(channel domain.Channel) bool
	Send(ctx context.Context, notification *domain.Notification) error
}

// EmailConfig contains email provider configuration
type EmailConfig struct {
	FromEmail string
	FromName  string
	Region    string
}

// EmailMessage represents an email to be sent
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

// Attachment represents an email attachment
type Attachment struct {
	Filename    string
	ContentType string
	Data        []byte
}

// NotificationToEmailMessage converts a domain.Notification to an EmailMessage
// It extracts the recipient email from the Recipient JSONB field
func NotificationToEmailMessage(n *domain.Notification, cfg EmailConfig) (*EmailMessage, error) {
	// Extract recipient email from JSONB map
	toEmail := ""
	if n.Recipient != nil {
		if addr, ok := n.Recipient["address"].(string); ok {
			toEmail = addr
		}
	}

	if toEmail == "" {
		return nil, fmt.Errorf("notification missing recipient email address")
	}

	subject := ""
	if n.Subject != nil {
		subject = *n.Subject
	}

	var htmlBody string
	var textBody string

	if isHTML(n.Body) {
		htmlBody = n.Body
		textBody = stripHTML(n.Body)
	} else {
		htmlBody = renderHTMLFromText(n.Body)
		textBody = n.Body
	}

	return &EmailMessage{
		From:     cfg.FromEmail,
		FromName: cfg.FromName,
		To:       []string{toEmail},
		Subject:  subject,
		TextBody: textBody,
		HTMLBody: htmlBody,
		Tags: map[string]string{
			"notification_id": n.ID.String(),
			"channel":         string(n.Channel),
		},
	}, nil
}

// isHTML checks if the body contains HTML tags
func isHTML(text string) bool {
	t := strings.TrimSpace(strings.ToLower(text))
	return strings.HasPrefix(t, "<!doctype html") || strings.HasPrefix(t, "<html") || strings.Contains(t, "<body") || strings.Contains(t, "</html>")
}

// stripHTML removes HTML tags for plain text fallback
func stripHTML(html string) string {
	r := regexp.MustCompile("<[^>]*>")
	return strings.TrimSpace(r.ReplaceAllString(html, ""))
}

// renderHTMLFromText converts plain text to basic HTML
func renderHTMLFromText(text string) string {
	// Escape HTML special characters
	escaped := strings.ReplaceAll(text, "&", "&amp;")
	escaped = strings.ReplaceAll(escaped, "<", "&lt;")
	escaped = strings.ReplaceAll(escaped, ">", "&gt;")
	escaped = strings.ReplaceAll(escaped, "\"", "&quot;")

	// Convert newlines to <br> tags
	htmlText := strings.ReplaceAll(escaped, "\n", "<br>")

	return fmt.Sprintf(`<!DOCTYPE html>
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
</html>`, htmlText)
}
