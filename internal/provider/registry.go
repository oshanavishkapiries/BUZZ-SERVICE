package provider

import (
	"context"
	"fmt"
	"sync"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/elight/buzz-service/internal/provider/email"
	"github.com/elight/buzz-service/internal/provider/push"
	"github.com/elight/buzz-service/internal/provider/sms"
	"github.com/elight/buzz-service/internal/store"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// Registry loads provider configurations from the database and builds live provider
// instances from them. The worker calls Resolve() at delivery time.
type Registry struct {
	dbStore     *store.PostgresStore
	redisClient *redis.Client
	mu          sync.RWMutex
	byName      map[uuid.UUID]map[string]Provider             // appID → name → live instance
	byChannel   map[uuid.UUID]map[domain.Channel][]namedEntry // appID → channel → ordered
	fixed       map[domain.Channel]Provider
}

type namedEntry struct {
	name      string
	isDefault bool
	provider  Provider
}

// NewRegistry creates a registry and performs an initial load from the database.
func NewRegistry(ctx context.Context, dbStore *store.PostgresStore, redisClient *redis.Client) (*Registry, error) {
	r := &Registry{
		dbStore:     dbStore,
		redisClient: redisClient,
		byName:      make(map[uuid.UUID]map[string]Provider),
		byChannel:   make(map[uuid.UUID]map[domain.Channel][]namedEntry),
		fixed:       make(map[domain.Channel]Provider),
	}
	if err := r.Reload(ctx); err != nil {
		return nil, err
	}
	return r, nil
}

// Reload rebuilds the in-memory cache from the database. Safe to call at runtime.
func (r *Registry) Reload(ctx context.Context) error {
	configs, err := r.dbStore.ListAllProviderConfigs(ctx)
	if err != nil {
		return fmt.Errorf("failed to load provider configs: %w", err)
	}

	byName := make(map[uuid.UUID]map[string]Provider)
	byChannel := make(map[uuid.UUID]map[domain.Channel][]namedEntry)

	for _, pc := range configs {
		if !pc.IsActive {
			continue
		}
		p, err := buildProvider(ctx, pc)
		if err != nil {
			// Log but keep going — a single bad config shouldn't block all providers
			fmt.Printf("[provider.Registry] skipping %q: %v\n", pc.Name, err)
			continue
		}

		if _, ok := byName[pc.ApplicationID]; !ok {
			byName[pc.ApplicationID] = make(map[string]Provider)
			byChannel[pc.ApplicationID] = make(map[domain.Channel][]namedEntry)
		}

		byName[pc.ApplicationID][pc.Name] = p
		byChannel[pc.ApplicationID][pc.Channel] = append(byChannel[pc.ApplicationID][pc.Channel], namedEntry{
			name:      pc.Name,
			isDefault: pc.IsDefault,
			provider:  p,
		})
	}

	// Sort so defaults come first within each channel
	for appID := range byChannel {
		for ch := range byChannel[appID] {
			entries := byChannel[appID][ch]
			sorted := make([]namedEntry, 0, len(entries))
			for _, e := range entries {
				if e.isDefault {
					sorted = append([]namedEntry{e}, sorted...)
				} else {
					sorted = append(sorted, e)
				}
			}
			byChannel[appID][ch] = sorted
		}
	}

	r.mu.Lock()
	r.byName = byName
	r.byChannel = byChannel
	r.mu.Unlock()
	return nil
}

// Resolve returns the provider to use for a notification.
//   - providerName non-empty → look up by name
//   - providerName empty    → return the default (or first active) for that channel
func (r *Registry) Resolve(appID uuid.UUID, channel domain.Channel, providerName string) (Provider, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// Fallback to fixed (e.g. in-app) first
	if channel == domain.ChannelInApp {
		if p, ok := r.fixed[channel]; ok {
			return p, nil
		}
	}

	if providerName != "" {
		appProviders, ok := r.byName[appID]
		if !ok {
			return nil, fmt.Errorf("provider %q not found or inactive for app %s", providerName, appID)
		}
		p, ok := appProviders[providerName]
		if !ok {
			return nil, fmt.Errorf("provider %q not found or inactive for app %s", providerName, appID)
		}
		return p, nil
	}

	appChannels, ok := r.byChannel[appID]
	if !ok {
		return nil, fmt.Errorf("no active provider configured for channel %q for app %s", channel, appID)
	}
	entries := appChannels[channel]
	if len(entries) == 0 {
		return nil, fmt.Errorf("no active provider configured for channel %q for app %s", channel, appID)
	}
	return entries[0].provider, nil
}

// RegisterFixed adds a provider directly without a DB config (e.g. in-app).
// It is always placed first for its channel and is never evicted by Reload.
func (r *Registry) RegisterFixed(channel domain.Channel, p Provider) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.fixed == nil {
		r.fixed = make(map[domain.Channel]Provider)
	}
	r.fixed[channel] = p
}

// HasAny reports whether at least one active provider exists for the channel.
func (r *Registry) HasAny(appID uuid.UUID, channel domain.Channel) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if channel == domain.ChannelInApp {
		if _, ok := r.fixed[channel]; ok {
			return true
		}
	}

	appChannels, ok := r.byChannel[appID]
	if !ok {
		return false
	}
	return len(appChannels[channel]) > 0
}

// buildProvider constructs a live provider from a stored ProviderConfig.
func buildProvider(ctx context.Context, pc domain.ProviderConfig) (Provider, error) {
	cfg := pc.Config // map[string]interface{}

	switch pc.Channel {
	case domain.ChannelEmail:
		return buildEmailProvider(ctx, pc.Provider, cfg)
	case domain.ChannelSMS:
		return buildSMSProvider(pc.Provider, cfg)
	case domain.ChannelPush:
		return buildPushProvider(ctx, pc.Provider, cfg)
	default:
		return nil, fmt.Errorf("unsupported channel: %s", pc.Channel)
	}
}

func buildEmailProvider(ctx context.Context, providerType string, cfg map[string]interface{}) (Provider, error) {
	fromEmail := getString(cfg, "from_email")
	fromName := getString(cfg, "from_name")
	emailCfg := email.EmailConfig{FromEmail: fromEmail, FromName: fromName}

	switch providerType {
	case "ses":
		emailCfg.Region = getString(cfg, "region")
		p, err := email.NewSESProvider(ctx, emailCfg)
		if err != nil {
			return nil, err
		}
		return applyEmailRateLimit(p, cfg), nil

	case "smtp":
		smtpCfg := email.SMTPConfig{
			Host:     getString(cfg, "host"),
			Port:     getInt(cfg, "port", 587),
			Username: getString(cfg, "username"),
			Password: getString(cfg, "password"),
			UseTLS:   getBool(cfg, "use_tls", true),
		}
		p := email.NewSMTPProvider(smtpCfg, emailCfg)
		return applyEmailRateLimit(p, cfg), nil

	default:
		return nil, fmt.Errorf("unknown email provider type: %s", providerType)
	}
}

func buildSMSProvider(providerType string, cfg map[string]interface{}) (Provider, error) {
	rateLimit := getInt(cfg, "rate_limit_per_second", 10)

	switch providerType {
	case "twilio":
		p := sms.NewTwilioProvider(sms.TwilioConfig{
			AccountSID:          getString(cfg, "account_sid"),
			AuthToken:           getString(cfg, "auth_token"),
			FromNumber:          getString(cfg, "from_number"),
			MessagingServiceSID: getString(cfg, "messaging_service_sid"),
		})
		return sms.NewRateLimitedSMSProvider(p, rateLimit), nil

	case "textlk":
		p := sms.NewTextLKProvider(sms.TextLKConfig{
			APIToken: getString(cfg, "api_token"),
			SenderID: getString(cfg, "sender_id"),
		})
		return sms.NewRateLimitedSMSProvider(p, rateLimit), nil

	default:
		return nil, fmt.Errorf("unknown SMS provider type: %s", providerType)
	}
}

func buildPushProvider(ctx context.Context, providerType string, cfg map[string]interface{}) (Provider, error) {
	switch providerType {
	case "fcm":
		fcmCfg := push.FCMConfig{
			ProjectID: getString(cfg, "project_id"),
		}
		// credentials_json takes priority over credentials_file
		if credJSON := getString(cfg, "credentials_json"); credJSON != "" {
			fcmCfg.CredentialsJSON = credJSON
		} else {
			fcmCfg.CredentialsFile = getString(cfg, "credentials_file")
		}
		return push.NewFCMProvider(ctx, fcmCfg)

	default:
		return nil, fmt.Errorf("unknown push provider type: %s", providerType)
	}
}

func applyEmailRateLimit(p email.EmailProvider, cfg map[string]interface{}) email.EmailProvider {
	if rps := getInt(cfg, "rate_limit_rps", 0); rps > 0 {
		return email.NewRateLimitedProvider(p, rps)
	}
	return p
}

// ── config map helpers ──────────────────────────────────────────────────────

func getString(cfg map[string]interface{}, key string) string {
	if v, ok := cfg[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func getInt(cfg map[string]interface{}, key string, defaultVal int) int {
	if v, ok := cfg[key]; ok {
		switch n := v.(type) {
		case float64:
			return int(n)
		case int:
			return n
		}
	}
	return defaultVal
}

func getBool(cfg map[string]interface{}, key string, defaultVal bool) bool {
	if v, ok := cfg[key]; ok {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return defaultVal
}
