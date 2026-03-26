package email

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/smtp"
	"strings"

	"github.com/elight/buzz-service/internal/domain"
)

// SMTPProvider implements EmailProvider for SMTP-based email delivery
type SMTPProvider struct {
	host     string
	port     int
	username string
	password string
	useTLS   bool
	config   EmailConfig
}

// SMTPConfig contains SMTP configuration
type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	UseTLS   bool
}

// NewSMTPProvider creates a new SMTP email provider
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

// SendEmail sends an email via SMTP
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
		return p.sendWithTLS(ctx, auth, msg.From, recipients, message.String(), addr)
	}

	return smtp.SendMail(addr, auth, msg.From, recipients, []byte(message.String()))
}

// sendWithTLS sends email using TLS connection
func (p *SMTPProvider) sendWithTLS(ctx context.Context, auth smtp.Auth, from string, recipients []string, msgData string, addr string) error {
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

	if err := client.Mail(from); err != nil {
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

	_, err = writer.Write([]byte(msgData))
	if err != nil {
		return fmt.Errorf("write failed: %w", err)
	}

	err = writer.Close()
	if err != nil {
		return fmt.Errorf("close failed: %w", err)
	}

	return nil
}

// Name returns the provider name
func (p *SMTPProvider) Name() string {
	return "smtp"
}

// SupportsChannel checks if the provider supports a given channel
func (p *SMTPProvider) SupportsChannel(channel domain.Channel) bool {
	return channel == domain.ChannelEmail
}

// Send delivers a notification via email using SMTP
func (p *SMTPProvider) Send(ctx context.Context, notification *domain.Notification) error {
	msg, err := NotificationToEmailMessage(notification, p.config)
	if err != nil {
		return fmt.Errorf("failed to convert notification to email: %w", err)
	}
	return p.SendEmail(ctx, msg)
}
