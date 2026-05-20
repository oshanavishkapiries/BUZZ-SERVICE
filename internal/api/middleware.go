package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/elight/buzz-service/internal/store"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type contextKey string

const (
	ContextKeyAPIKey contextKey = "api_key"
	ContextKeyScopes contextKey = "scopes"
)

// AuthMiddleware validates API key or JWT token authentication
func AuthMiddleware(db *store.PostgresStore, jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Extract Authorization header or fallback to query param
		auth := c.Get("Authorization")
		if auth == "" {
			if t := c.Query("token"); t != "" {
				auth = "Bearer " + t
			}
		}
		if auth == "" {
			return c.Status(401).JSON(fiber.Map{
				"error": "missing authorization header",
			})
		}

		// Expected format: "Bearer <token>"
		parts := strings.SplitN(auth, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Status(401).JSON(fiber.Map{
				"error": "invalid authorization format, expected 'Bearer <token>'",
			})
		}

		tokenStr := parts[1]

		// Check if it's an API Key (prefixed with "buzz_")
		if strings.HasPrefix(tokenStr, "buzz_") {
			// API Key Auth Flow
			keyHash := hashAPIKey(tokenStr)

			repo := store.NewAPIKeyRepository(db.DB())
			key, err := repo.GetByKeyHash(c.Context(), keyHash)
			if err != nil {
				return c.Status(401).JSON(fiber.Map{
					"error": "invalid api key",
				})
			}

			if !key.IsActive {
				return c.Status(401).JSON(fiber.Map{
					"error": "api key is inactive",
				})
			}

			if key.ExpiresAt != nil && key.ExpiresAt.Before(time.Now()) {
				return c.Status(401).JSON(fiber.Map{
					"error": "api key has expired",
				})
			}

			c.Locals(string(ContextKeyAPIKey), key)
			c.Locals("application_id", key.ApplicationID)
			c.Locals(string(ContextKeyScopes), key.Scopes)

			userID := c.Get("X-User-ID")
			if userID == "" {
				userID = c.Query("user_id")
			}
			c.Locals("user_id", userID)

			// Update key usage async
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				_ = repo.UpdateUsage(ctx, key.ID)
			}()

			return c.Next()
		}

		// Otherwise, treat as JWT token (Dashboard User session)
		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			return c.Status(401).JSON(fiber.Map{
				"error": "invalid or expired token",
			})
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.Status(401).JSON(fiber.Map{
				"error": "invalid token claims",
			})
		}

		userIDStr, ok := claims["user_id"].(string)
		if !ok {
			return c.Status(401).JSON(fiber.Map{
				"error": "invalid token claims: user_id missing",
			})
		}

		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			return c.Status(401).JSON(fiber.Map{
				"error": "invalid user id in token claims",
			})
		}

		// Dashboard user routes need X-Application-ID header to scope resource operations
		// EXCEPT for global user/workspace management routes: /api/v1/auth/me, /api/v1/applications, /api/v1/users, and real-time stream /api/v1/stream
		path := c.Path()
		isGlobalRoute := path == "/api/v1/auth/me" || path == "/api/v1/applications" || strings.HasPrefix(path, "/api/v1/users") || strings.HasPrefix(path, "/api/v1/stream")

		if isGlobalRoute {
			// Set context values for global routes without application scope and bypass application validation entirely
			c.Locals("auth_user_id", userIDStr)
			
			// Allow query parameter or header to specify/override user_id (needed for developers to monitor user streams)
			userIDVal := c.Get("X-User-ID")
			if userIDVal == "" {
				userIDVal = c.Query("user_id")
			}
			if userIDVal == "" {
				userIDVal = userIDStr
			}
			c.Locals("user_id", userIDVal)
			c.Locals(string(ContextKeyScopes), []string{"*"})
			return c.Next()
		}

		appIDStr := c.Get("X-Application-ID")
		if appIDStr == "" {
			appIDStr = c.Query("application_id")
		}

		if appIDStr == "" {
			return c.Status(400).JSON(fiber.Map{
				"error": "X-Application-ID header or application_id query parameter is required for session-based requests",
			})
		}

		appID, err := uuid.Parse(appIDStr)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{
				"error": "invalid application ID format",
			})
		}

		// Verify user membership in application
		isMember, err := db.IsApplicationMember(c.Context(), appID, userID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"error": "failed to verify application access permissions",
			})
		}

		if !isMember {
			return c.Status(403).JSON(fiber.Map{
				"error": "forbidden: you are not a member of this application",
			})
		}

		// Set context values
		c.Locals("auth_user_id", userIDStr)

		// Allow X-User-ID header to override user_id — dashboard admins can query inbox/devices
		// on behalf of any end-user (e.g. to inspect a recipient's inbox after sending in_app notification)
		effectiveUserID := c.Get("X-User-ID")
		if effectiveUserID == "" {
			effectiveUserID = userIDStr
		}
		c.Locals("user_id", effectiveUserID)
		c.Locals("application_id", appID)
		// Dashboard users have full permission scopes
		c.Locals(string(ContextKeyScopes), []string{"*"})

		return c.Next()
	}
}

// RequireScope checks if the API key or authenticated user has the required scope
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

// GetApplicationID retrieves the application ID associated with the request context
func GetApplicationID(c *fiber.Ctx) (uuid.UUID, error) {
	appIDVal := c.Locals("application_id")
	if appIDVal == nil {
		return uuid.Nil, c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthorized: application context not found",
		})
	}
	appID, ok := appIDVal.(uuid.UUID)
	if !ok {
		return uuid.Nil, c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "internal error: invalid application ID type",
		})
	}
	return appID, nil
}
