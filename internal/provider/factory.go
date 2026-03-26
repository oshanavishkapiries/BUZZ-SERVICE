package provider

import (
	"context"
	"fmt"

	"github.com/elight/buzz-service/internal/config"
	"github.com/elight/buzz-service/internal/provider/email"
)

// NewEmailProvider creates an email provider based on configuration
func NewEmailProvider(ctx context.Context, cfg *config.Config) (email.EmailProvider, error) {
	emailCfg := email.EmailConfig{
		FromEmail: cfg.Email.FromEmail,
		FromName:  cfg.Email.FromName,
		Region:    cfg.AWS.Region,
	}

	var provider email.EmailProvider
	var err error

	switch cfg.Email.Provider {
	case "ses":
		provider, err = email.NewSESProvider(ctx, emailCfg)
		if err != nil {
			return nil, fmt.Errorf("failed to create SES provider: %w", err)
		}

	case "smtp":
		smtpCfg := email.SMTPConfig{
			Host:     cfg.SMTP.Host,
			Port:     cfg.SMTP.Port,
			Username: cfg.SMTP.Username,
			Password: cfg.SMTP.Password,
			UseTLS:   cfg.SMTP.UseTLS,
		}
		provider = email.NewSMTPProvider(smtpCfg, emailCfg)

	default:
		return nil, fmt.Errorf("unknown email provider: %s", cfg.Email.Provider)
	}

	// Wrap with rate limiter if configured
	if cfg.Email.RateLimitRPS > 0 {
		provider = email.NewRateLimitedProvider(provider, cfg.Email.RateLimitRPS)
	}

	return provider, nil
}
