package email

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	"github.com/aws/aws-sdk-go-v2/service/sesv2/types"
	"github.com/elight/buzz-service/internal/domain"
)

// SESProvider implements EmailProvider for Amazon Simple Email Service
type SESProvider struct {
	client *sesv2.Client
	config EmailConfig
}

// NewSESProvider creates a new Amazon SES email provider
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

// SendEmail sends an email via Amazon SES
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

	// Add email tags
	if len(msg.Tags) > 0 {
		var tags []types.MessageTag
		for key, value := range msg.Tags {
			v := value // Create a copy for the pointer
			tags = append(tags, types.MessageTag{
				Name:  aws.String(key),
				Value: aws.String(v),
			})
		}
		input.EmailTags = tags
	}

	result, err := p.client.SendEmail(ctx, input)
	if err != nil {
		return fmt.Errorf("SES send failed: %w", err)
	}

	// result.MessageId can be used for tracking
	_ = result.MessageId

	return nil
}

// Name returns the provider name
func (p *SESProvider) Name() string {
	return "amazon-ses"
}

// SupportsChannel checks if the provider supports a given channel
func (p *SESProvider) SupportsChannel(channel domain.Channel) bool {
	return channel == domain.ChannelEmail
}

// Send delivers a notification via email using Amazon SES
func (p *SESProvider) Send(ctx context.Context, notification *domain.Notification) error {
	msg, err := NotificationToEmailMessage(notification, p.config)
	if err != nil {
		return fmt.Errorf("failed to convert notification to email: %w", err)
	}
	return p.SendEmail(ctx, msg)
}
