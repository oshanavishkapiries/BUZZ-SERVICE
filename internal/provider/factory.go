package provider

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
	"github.com/elight/buzz-service/internal/config"
	"github.com/elight/buzz-service/internal/provider/email"
	"github.com/elight/buzz-service/internal/provider/inapp"
	"github.com/elight/buzz-service/internal/provider/push"
	"github.com/elight/buzz-service/internal/provider/sms"
	"github.com/elight/buzz-service/internal/store"
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

// NewSMSProvider creates an SMS provider based on configuration
func NewSMSProvider(cfg *config.Config) (sms.SMSProvider, error) {
	switch cfg.SMS.Provider {
	case "textlk":
		textLKProvider := sms.NewTextLKProvider(sms.TextLKConfig{
			APIToken: cfg.TextLK.APIToken,
			SenderID: cfg.TextLK.SenderID,
		})
		rateLimited := sms.NewRateLimitedSMSProvider(textLKProvider, cfg.SMS.RateLimitPerSecond)
		return rateLimited, nil

	case "twilio":
		twilioProvider := sms.NewTwilioProvider(sms.TwilioConfig{
			AccountSID:          cfg.Twilio.AccountSID,
			AuthToken:           cfg.Twilio.AuthToken,
			FromNumber:          cfg.Twilio.FromNumber,
			MessagingServiceSID: cfg.Twilio.MessagingServiceSID,
		})
		rateLimited := sms.NewRateLimitedSMSProvider(twilioProvider, cfg.SMS.RateLimitPerSecond)
		return rateLimited, nil

	case "router":
		// Create Text.lk provider (primary for Sri Lanka)
		textLKProvider := sms.NewTextLKProvider(sms.TextLKConfig{
			APIToken: cfg.TextLK.APIToken,
			SenderID: cfg.TextLK.SenderID,
		})

		// Create Twilio provider (fallback for international)
		twilioProvider := sms.NewTwilioProvider(sms.TwilioConfig{
			AccountSID:          cfg.Twilio.AccountSID,
			AuthToken:           cfg.Twilio.AuthToken,
			FromNumber:          cfg.Twilio.FromNumber,
			MessagingServiceSID: cfg.Twilio.MessagingServiceSID,
		})

		// Create router with Text.lk as primary for Sri Lanka, Twilio as fallback
		router := sms.NewSMSRouter(
			[]sms.SMSProvider{textLKProvider},
			twilioProvider,
		)

		rateLimited := sms.NewRateLimitedSMSProvider(router, cfg.SMS.RateLimitPerSecond)
		return rateLimited, nil

	default:
		return nil, fmt.Errorf("unknown SMS provider: %s", cfg.SMS.Provider)
	}
}

// NewPushProvider creates a push provider based on configuration
func NewPushProvider(ctx context.Context, cfg *config.Config) (*push.FCMProvider, error) {
	fcmCfg := push.FCMConfig{
		CredentialsFile: cfg.Push.CredentialsFile,
		ProjectID:       cfg.Push.ProjectID,
	}

	provider, err := push.NewFCMProvider(ctx, fcmCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create FCM provider: %w", err)
	}

	return provider, nil
}

// NewInAppProvider creates an in-app notification provider
func NewInAppProvider(st *store.PostgresStore, redisClient *redis.Client) *inapp.InAppProvider {
	return inapp.NewInAppProvider(st, redisClient)
}
