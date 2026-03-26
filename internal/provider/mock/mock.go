package mock

import (
	"context"
	"fmt"
	"time"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/elight/buzz-service/internal/provider"
	"github.com/rs/zerolog"
)

type MockProvider struct {
	name    string
	channel domain.Channel
	delay   time.Duration
	logger  zerolog.Logger
}

func NewMockProvider(name string, channel domain.Channel, logger zerolog.Logger) provider.Provider {
	return &MockProvider{
		name:    name,
		channel: channel,
		delay:   100 * time.Millisecond,
		logger:  logger,
	}
}

func (p *MockProvider) Send(ctx context.Context, n *domain.Notification) error {
	// Simulate processing time
	time.Sleep(p.delay)

	// Extract recipient address from recipient JSONB
	recipientAddr := ""
	if n.Recipient != nil {
		if addr, ok := n.Recipient["address"].(string); ok {
			recipientAddr = addr
		}
	}

	// Simulate 5% failure rate for testing retry logic
	if time.Now().Unix()%20 == 0 {
		err := fmt.Errorf("mock provider: simulated failure")
		p.logger.Error().
			Err(err).
			Str("notification_id", n.ID.String()).
			Str("to", recipientAddr).
			Msg("Mock provider simulated failure")
		return err
	}

	p.logger.Info().
		Str("notification_id", n.ID.String()).
		Str("provider", p.name).
		Str("channel", string(n.Channel)).
		Str("to", recipientAddr).
		Msg("Mock provider delivered notification")

	return nil
}

func (p *MockProvider) Name() string {
	return p.name
}

func (p *MockProvider) SupportsChannel(channel domain.Channel) bool {
	return channel == p.channel
}
