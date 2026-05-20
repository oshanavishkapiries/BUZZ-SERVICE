package api

import (
	"strings"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/elight/buzz-service/internal/store"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type UserHandler struct {
	store *store.PostgresStore
}

func NewUserHandler(st *store.PostgresStore) *UserHandler {
	return &UserHandler{store: st}
}

// checkOwner verifies that the authenticated user is a system owner
func (h *UserHandler) checkOwner(c *fiber.Ctx) (*domain.User, error) {
	userIDStr, ok := c.Locals("auth_user_id").(string)
	if !ok || userIDStr == "" {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "unauthorized")
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "invalid user id in session")
	}

	user, err := h.store.GetUserByID(c.Context(), userID)
	if err != nil {
		return nil, fiber.NewError(fiber.StatusInternalServerError, "failed to fetch user profile")
	}

	if user.Role != "owner" {
		return nil, fiber.NewError(fiber.StatusForbidden, "only system owners can access this resource")
	}

	return user, nil
}

func (h *UserHandler) ListUsers(c *fiber.Ctx) error {
	if _, err := h.checkOwner(c); err != nil {
		code := fiber.StatusInternalServerError
		if fe, ok := err.(*fiber.Error); ok {
			code = fe.Code
		}
		return c.Status(code).JSON(fiber.Map{"error": err.Error()})
	}

	users, err := h.store.ListUsers(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to list users",
		})
	}

	if users == nil {
		users = []domain.User{}
	}

	return c.JSON(fiber.Map{
		"users": users,
	})
}

func (h *UserHandler) CreateUser(c *fiber.Ctx) error {
	if _, err := h.checkOwner(c); err != nil {
		code := fiber.StatusInternalServerError
		if fe, ok := err.(*fiber.Error); ok {
			code = fe.Code
		}
		return c.Status(code).JSON(fiber.Map{"error": err.Error()})
	}

	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Name = strings.TrimSpace(req.Name)
	req.Role = strings.TrimSpace(req.Role)

	if req.Email == "" || req.Password == "" || req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "name, email, and password are required",
		})
	}

	if len(req.Password) < 6 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "password must be at least 6 characters long",
		})
	}

	if req.Role == "" {
		req.Role = "user"
	}

	if req.Role != "owner" && req.Role != "user" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid role: must be owner or user",
		})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to hash password",
		})
	}

	newUser := &domain.User{
		ID:           uuid.New(),
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Name:         req.Name,
		Role:         req.Role,
	}

	if err := h.store.CreateUser(c.Context(), newUser); err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "a user with this email address already exists",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create user account",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"user": fiber.Map{
			"id":    newUser.ID,
			"name":  newUser.Name,
			"email": newUser.Email,
			"role":  newUser.Role,
		},
	})
}

func (h *UserHandler) DeleteUser(c *fiber.Ctx) error {
	if _, err := h.checkOwner(c); err != nil {
		code := fiber.StatusInternalServerError
		if fe, ok := err.(*fiber.Error); ok {
			code = fe.Code
		}
		return c.Status(code).JSON(fiber.Map{"error": err.Error()})
	}

	idStr := c.Params("id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid user ID format",
		})
	}

	// Prevent deleting yourself
	callerIDStr := c.Locals("auth_user_id").(string)
	if idStr == callerIDStr {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "cannot delete your own account",
		})
	}

	callerID, err := uuid.Parse(callerIDStr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to parse caller ID",
		})
	}

	if err := h.store.DeleteUser(c.Context(), userID, callerID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to delete user",
		})
	}

	return c.JSON(fiber.Map{
		"message": "user deleted successfully",
	})
}
