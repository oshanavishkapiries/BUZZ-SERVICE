package api

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/elight/buzz-service/internal/store"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type ApplicationHandler struct {
	store *store.PostgresStore
}

func NewApplicationHandler(st *store.PostgresStore) *ApplicationHandler {
	return &ApplicationHandler{store: st}
}

func (h *ApplicationHandler) ListApplications(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("auth_user_id").(string)
	if !ok || userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthorized",
		})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "invalid user id in session",
		})
	}

	apps, err := h.store.ListApplicationsByUserID(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to list applications",
		})
	}

	// If list is nil, return empty slice
	if apps == nil {
		apps = []domain.Application{}
	}

	return c.JSON(fiber.Map{
		"applications": apps,
	})
}

func (h *ApplicationHandler) CreateApplication(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("auth_user_id").(string)
	if !ok || userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthorized",
		})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "invalid user id in session",
		})
	}

	var req struct {
		Name        string  `json:"name"`
		Description *string `json:"description"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "application name is required",
		})
	}

	appID := uuid.New()
	app := &domain.Application{
		ID:          appID,
		Name:        req.Name,
		Description: req.Description,
		OwnerID:     userID,
	}

	if err := h.store.CreateApplication(c.Context(), app); err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "an application with this name already exists",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create application",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"application": app,
	})
}

func (h *ApplicationHandler) ListAPIKeys(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("auth_user_id").(string)
	if !ok || userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthorized",
		})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "invalid user id in session",
		})
	}

	appIDStr := c.Params("appId")
	appID, err := uuid.Parse(appIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid application ID",
		})
	}

	// Verify user membership
	isMember, err := h.store.IsApplicationMember(c.Context(), appID, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to verify application access",
		})
	}
	if !isMember {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "access denied to this application",
		})
	}

	repo := store.NewAPIKeyRepository(h.store.DB())
	keys, err := repo.List(c.Context(), appID, nil, 0, 0)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to list API keys",
		})
	}

	if keys == nil {
		keys = []*domain.APIKey{}
	}

	return c.JSON(fiber.Map{
		"api_keys": keys,
	})
}

func (h *ApplicationHandler) CreateAPIKey(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("auth_user_id").(string)
	if !ok || userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthorized",
		})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "invalid user id in session",
		})
	}

	appIDStr := c.Params("appId")
	appID, err := uuid.Parse(appIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid application ID",
		})
	}

	// Verify user membership
	isMember, err := h.store.IsApplicationMember(c.Context(), appID, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to verify application access",
		})
	}
	if !isMember {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "access denied to this application",
		})
	}

	var req struct {
		Name        string             `json:"name"`
		Description *string            `json:"description"`
		Environment domain.Environment `json:"environment"`
		Scopes      []string           `json:"scopes"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "api key name is required",
		})
	}

	if req.Environment == "" {
		req.Environment = domain.EnvProduction
	}

	if req.Environment != domain.EnvProduction &&
		req.Environment != domain.EnvStaging &&
		req.Environment != domain.EnvDevelopment &&
		req.Environment != domain.EnvTest {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid environment",
		})
	}

	if len(req.Scopes) == 0 {
		req.Scopes = []string{"*"} // Grant all permissions by default
	}

	// Generate raw API Key
	randBytes := make([]byte, 24)
	if _, err := rand.Read(randBytes); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to generate secure key",
		})
	}

	// Format: buzz_{environment}_{hex}
	rawKey := fmt.Sprintf("buzz_%s_%s", req.Environment, hex.EncodeToString(randBytes))

	// Hash key
	hash := sha256.Sum256([]byte(rawKey))
	keyHash := hex.EncodeToString(hash[:])

	// Prefix (buzz_prod_xxxx or buzz_dev_xxxxx)
	prefixLen := 12
	if len(rawKey) < prefixLen {
		prefixLen = len(rawKey)
	}
	keyPrefix := rawKey[:prefixLen]

	apiKey := &domain.APIKey{
		ApplicationID: appID,
		Name:          req.Name,
		Description:   req.Description,
		KeyHash:       keyHash,
		KeyPrefix:     keyPrefix,
		Environment:   req.Environment,
		Scopes:        req.Scopes,
		IsActive:      true,
		CreatedBy:     &userID,
	}

	repo := store.NewAPIKeyRepository(h.store.DB())
	if err := repo.Create(c.Context(), apiKey); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create api key in database",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"raw_key": rawKey,
		"api_key": apiKey,
	})
}

func (h *ApplicationHandler) DeleteAPIKey(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("auth_user_id").(string)
	if !ok || userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthorized",
		})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "invalid user id in session",
		})
	}

	appIDStr := c.Params("appId")
	appID, err := uuid.Parse(appIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid application ID",
		})
	}

	keyIDStr := c.Params("keyId")
	keyID, err := uuid.Parse(keyIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid API key ID",
		})
	}

	// Verify user membership
	isMember, err := h.store.IsApplicationMember(c.Context(), appID, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to verify application access",
		})
	}
	if !isMember {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "access denied to this application",
		})
	}

	repo := store.NewAPIKeyRepository(h.store.DB())
	if err := repo.Delete(c.Context(), appID, keyID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to delete api key",
		})
	}

	return c.JSON(fiber.Map{
		"message": "API key deleted successfully",
	})
}

func (h *ApplicationHandler) ListMembers(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("auth_user_id").(string)
	if !ok || userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthorized",
		})
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "invalid user id in session",
		})
	}

	appIDStr := c.Params("appId")
	appID, err := uuid.Parse(appIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid application ID",
		})
	}

	// Verify caller has access to the application
	isMember, err := h.store.IsApplicationMember(c.Context(), appID, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to verify application access",
		})
	}
	if !isMember {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "access denied to this application",
		})
	}

	members, err := h.store.ListApplicationMembers(c.Context(), appID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to list application members",
		})
	}

	if members == nil {
		members = []domain.ApplicationMemberDetail{}
	}

	return c.JSON(fiber.Map{
		"members": members,
	})
}

func (h *ApplicationHandler) AddMember(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("auth_user_id").(string)
	if !ok || userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthorized",
		})
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "invalid user id in session",
		})
	}

	appIDStr := c.Params("appId")
	appID, err := uuid.Parse(appIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid application ID",
		})
	}

	// Verify caller has admin/owner permissions on the application
	role, err := h.store.GetApplicationMemberRole(c.Context(), appID, userID)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "access denied to this application",
		})
	}

	if role != "owner" && role != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "only application owners or admins can manage members",
		})
	}

	var req struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Role = strings.TrimSpace(req.Role)

	if req.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "email is required",
		})
	}

	if req.Role == "" {
		req.Role = "member"
	}

	if req.Role != "admin" && req.Role != "member" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid role: must be admin or member",
		})
	}

	// Find user by email
	targetUser, err := h.store.GetUserByEmail(c.Context(), req.Email)
	if err != nil {
		if err == domain.ErrUserNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "user with this email address does not exist. The system owner must create the user account first.",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to find user",
		})
	}

	member := &domain.ApplicationMember{
		ApplicationID: appID,
		UserID:        targetUser.ID,
		Role:          req.Role,
	}

	if err := h.store.AddApplicationMember(c.Context(), member); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to add member to application",
		})
	}

	return c.JSON(fiber.Map{
		"message": "member added successfully",
	})
}

func (h *ApplicationHandler) RemoveMember(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("auth_user_id").(string)
	if !ok || userIDStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthorized",
		})
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "invalid user id in session",
		})
	}

	appIDStr := c.Params("appId")
	appID, err := uuid.Parse(appIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid application ID",
		})
	}

	// Verify caller has admin/owner permissions on the application
	role, err := h.store.GetApplicationMemberRole(c.Context(), appID, userID)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "access denied to this application",
		})
	}

	if role != "owner" && role != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "only application owners or admins can manage members",
		})
	}

	targetUserIDStr := c.Params("userId")
	targetUserID, err := uuid.Parse(targetUserIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid user ID",
		})
	}

	// Prevent removing yourself
	if targetUserID == userID {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "cannot remove yourself from the application",
		})
	}

	// Get target user's role to prevent non-owners removing owners
	targetRole, err := h.store.GetApplicationMemberRole(c.Context(), appID, targetUserID)
	if err == nil && targetRole == "owner" && role != "owner" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "only the owner can remove other owners",
		})
	}

	if err := h.store.RemoveApplicationMember(c.Context(), appID, targetUserID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to remove member from application",
		})
	}

	return c.JSON(fiber.Map{
		"message": "member removed successfully",
	})
}
