package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type contextKey string

const (
	ContextKeyAPIKey contextKey = "api_key"
	ContextKeyScopes contextKey = "scopes"
)

// APIKeyStore defines the interface for API key storage operations
type APIKeyStore interface {
	GetAPIKeyByKeyHash(ctx context.Context, keyHash string) (*domain.APIKey, error)
	UpdateAPIKeyUsage(ctx context.Context, keyID uuid.UUID) error
}

// AuthMiddleware validates API key authentication
func AuthMiddleware(store APIKeyStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Extract API key from Authorization header
		auth := c.Get("Authorization")
		if auth == "" {
			return c.Status(401).JSON(fiber.Map{
				"error": "missing authorization header",
			})
		}

		// Expected format: "Bearer buzz_xxx..."
		parts := strings.SplitN(auth, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Status(401).JSON(fiber.Map{
				"error": "invalid authorization format, expected 'Bearer <token>'",
			})
		}

		apiKey := parts[1]

		// Validate key format (must start with buzz_)
		if !strings.HasPrefix(apiKey, "buzz_") {
			return c.Status(401).JSON(fiber.Map{
				"error": "invalid api key format, must start with 'buzz_'",
			})
		}

		// Hash the API key
		keyHash := hashAPIKey(apiKey)

		// Lookup key in database
		key, err := store.GetAPIKeyByKeyHash(c.Context(), keyHash)
		if err != nil {
			return c.Status(401).JSON(fiber.Map{
				"error": "invalid api key",
			})
		}

		// Check if active
		if !key.IsActive {
			return c.Status(401).JSON(fiber.Map{
				"error": "api key is inactive",
			})
		}

		// Check expiration
		if key.ExpiresAt != nil && key.ExpiresAt.Before(time.Now()) {
			return c.Status(401).JSON(fiber.Map{
				"error": "api key has expired",
			})
		}

		// Store key info in context
		c.Locals(string(ContextKeyAPIKey), key)
		c.Locals(string(ContextKeyScopes), key.Scopes)

		// Allow callers to identify the end-user via X-User-ID header.
		// This is needed for inbox and SSE endpoints which filter by user.
		c.Locals("user_id", c.Get("X-User-ID"))

		// Update last used timestamp (async to not block request)
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = store.UpdateAPIKeyUsage(ctx, key.ID)
		}()

		return c.Next()
	}
}

// RequireScope checks if the API key has the required scope
func RequireScope(scope string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		scopes, ok := c.Locals(string(ContextKeyScopes)).([]string)
		if !ok {
			return c.Status(403).JSON(fiber.Map{
				"error": "no scopes found in request context",
			})
		}

		// Check if required scope exists
		for _, s := range scopes {
			if s == scope || s == "*" { // "*" grants all permissions
				return c.Next()
			}
		}

		return c.Status(403).JSON(fiber.Map{
			"error":          "insufficient permissions",
			"required_scope": scope,
		})
	}
}

// hashAPIKey creates a SHA256 hash of the API key
// Note: In production, consider using bcrypt for key storage,
// but SHA256 is sufficient for lookup purposes
func hashAPIKey(key string) string {
	hash := sha256.Sum256([]byte(key))
	return hex.EncodeToString(hash[:])
}

// GetAPIKeyFromContext retrieves the API key from the request context
func GetAPIKeyFromContext(c *fiber.Ctx) *domain.APIKey {
	key, ok := c.Locals(string(ContextKeyAPIKey)).(*domain.APIKey)
	if !ok {
		return nil
	}
	return key
}
