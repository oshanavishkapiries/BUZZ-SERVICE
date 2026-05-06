package realtime

import (
	"bufio"
	"context"
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/elight/buzz-service/pkg/logger"
)

// Gateway manages real-time SSE connections and Redis Pub/Sub
type Gateway struct {
	connections *ConnectionManager
	pubsub      *redis.PubSub
	redis       *redis.Client
	logger      logger.Logger
	ctx         context.Context
	cancel      context.CancelFunc
}

// NewGateway creates a new SSE gateway
func NewGateway(redisClient *redis.Client, log logger.Logger) *Gateway {
	ctx, cancel := context.WithCancel(context.Background())

	return &Gateway{
		connections: NewConnectionManager(),
		redis:       redisClient,
		logger:      log,
		ctx:         ctx,
		cancel:      cancel,
	}
}

// Start starts the gateway and subscribes to Redis Pub/Sub
func (g *Gateway) Start() {
	go g.subscribeToPubSub()
	g.logger.Info().Msg("SSE gateway started")
}

// Stop stops the gateway and closes all connections
func (g *Gateway) Stop() {
	g.cancel()
	if g.pubsub != nil {
		g.pubsub.Close()
	}
	g.connections.CloseAll()
	g.logger.Info().Msg("SSE gateway stopped")
}

// HandleSSEConnection handles a new SSE client connection
func (g *Gateway) HandleSSEConnection(c *fiber.Ctx) error {
	// Get user ID from context (set by auth middleware)
	userID := c.Locals("user_id")
	if userID == nil {
		return c.Status(fiber.StatusUnauthorized).SendString("Unauthorized: missing user_id")
	}

	userIDStr := userID.(string)
	if userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).SendString("Unauthorized: invalid user_id")
	}

	// Set SSE headers
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no") // Disable nginx buffering

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		conn := NewSSEConnection(userIDStr, w, g.logger)

		// Register connection
		g.connections.Add(userIDStr, conn)
		defer g.connections.Remove(userIDStr, conn.ID)

		g.logger.Info().
			Str("user_id", userIDStr).
			Str("conn_id", conn.ID).
			Msg("SSE client connected")

		// Send initial connection event
		conn.Send("connected", map[string]interface{}{
			"status": "connected",
			"time":   time.Now(),
		})

		// Keep connection alive with heartbeats
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				// Send heartbeat
				if err := conn.Ping(); err != nil {
					g.logger.Debug().
						Str("user_id", userIDStr).
						Err(err).
						Msg("Heartbeat failed, closing connection")
					return
				}

			case <-conn.Done():
				g.logger.Info().
					Str("user_id", userIDStr).
					Str("conn_id", conn.ID).
					Msg("SSE client disconnected")
				return

			case <-g.ctx.Done():
				// Server is shutting down
				return
			}
		}
	})

	return nil
}

// subscribeToPubSub subscribes to all user channels and broadcasts messages
func (g *Gateway) subscribeToPubSub() {
	// Subscribe to pattern for all user channels
	g.pubsub = g.redis.PSubscribe(g.ctx, "user:*")

	ch := g.pubsub.Channel()

	for {
		select {
		case msg := <-ch:
			if msg == nil {
				return
			}

			// Extract user ID from channel name (user:123 -> 123)
			userID := msg.Channel[5:] // Remove "user:" prefix

			// Get all connections for this user
			connections := g.connections.GetUserConnections(userID)
			if len(connections) == 0 {
				continue
			}

			// Parse payload
			var payload map[string]interface{}
			if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
				g.logger.Error().Err(err).Msg("Failed to parse pub/sub message")
				continue
			}

			// Broadcast to all user connections
			for _, conn := range connections {
				if err := conn.Send("notification", payload); err != nil {
					g.logger.Error().
						Str("user_id", userID).
						Str("conn_id", conn.ID).
						Err(err).
						Msg("Failed to send notification to client")
				}
			}

		case <-g.ctx.Done():
			return
		}
	}
}

// GetStats returns connection statistics
func (g *Gateway) GetStats() map[string]int {
	return g.connections.GetStats()
}
