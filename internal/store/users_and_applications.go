package store

import (
	"context"
	"database/sql"
	"time"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/google/uuid"
)

// CreateUser inserts a new user record
func (s *PostgresStore) CreateUser(ctx context.Context, u *domain.User) error {
	u.CreatedAt = time.Now()
	u.UpdatedAt = time.Now()
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		u.ID, u.Email, u.PasswordHash, u.Name, u.CreatedAt, u.UpdatedAt,
	)
	return err
}

// GetUserByID retrieves a user by ID
func (s *PostgresStore) GetUserByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	var u domain.User
	err := s.db.QueryRowContext(ctx, `
		SELECT id, email, password_hash, name, created_at, updated_at
		FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.CreatedAt, &u.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, domain.ErrUserNotFound
	}
	return &u, err
}

// GetUserByEmail retrieves a user by email address
func (s *PostgresStore) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	var u domain.User
	err := s.db.QueryRowContext(ctx, `
		SELECT id, email, password_hash, name, created_at, updated_at
		FROM users WHERE email = $1`, email,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.CreatedAt, &u.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, domain.ErrUserNotFound
	}
	return &u, err
}

// CreateApplication inserts a new application record and adds the owner as an owner member
func (s *PostgresStore) CreateApplication(ctx context.Context, app *domain.Application) error {
	app.CreatedAt = time.Now()
	app.UpdatedAt = time.Now()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Insert application
	_, err = tx.ExecContext(ctx, `
		INSERT INTO applications (id, name, description, owner_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		app.ID, app.Name, app.Description, app.OwnerID, app.CreatedAt, app.UpdatedAt,
	)
	if err != nil {
		return err
	}

	// 2. Insert owner member
	_, err = tx.ExecContext(ctx, `
		INSERT INTO application_members (application_id, user_id, role, created_at)
		VALUES ($1, $2, $3, $4)`,
		app.ID, app.OwnerID, "owner", time.Now(),
	)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// GetApplication retrieves an application by ID
func (s *PostgresStore) GetApplication(ctx context.Context, id uuid.UUID) (*domain.Application, error) {
	var app domain.Application
	err := s.db.QueryRowContext(ctx, `
		SELECT id, name, description, owner_id, created_at, updated_at
		FROM applications WHERE id = $1`, id,
	).Scan(&app.ID, &app.Name, &app.Description, &app.OwnerID, &app.CreatedAt, &app.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, domain.ErrApplicationNotFound
	}
	return &app, err
}

// ListApplicationsByUserID returns all applications where the user is a member
func (s *PostgresStore) ListApplicationsByUserID(ctx context.Context, userID uuid.UUID) ([]domain.Application, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT a.id, a.name, a.description, a.owner_id, a.created_at, a.updated_at
		FROM applications a
		INNER JOIN application_members m ON a.id = m.application_id
		WHERE m.user_id = $1
		ORDER BY a.name`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []domain.Application
	for rows.Next() {
		var app domain.Application
		if err := rows.Scan(&app.ID, &app.Name, &app.Description, &app.OwnerID, &app.CreatedAt, &app.UpdatedAt); err != nil {
			return nil, err
		}
		apps = append(apps, app)
	}
	return apps, rows.Err()
}

// AddApplicationMember invites/adds a user to an application
func (s *PostgresStore) AddApplicationMember(ctx context.Context, member *domain.ApplicationMember) error {
	member.CreatedAt = time.Now()
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO application_members (application_id, user_id, role, created_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (application_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
		member.ApplicationID, member.UserID, member.Role, member.CreatedAt,
	)
	return err
}

// IsApplicationMember returns true if the user is a member of the application
func (s *PostgresStore) IsApplicationMember(ctx context.Context, appID, userID uuid.UUID) (bool, error) {
	var count int
	err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(1) FROM application_members
		WHERE application_id = $1 AND user_id = $2`, appID, userID,
	).Scan(&count)
	return count > 0, err
}

// GetApplicationMemberRole returns the role of the user inside the application
func (s *PostgresStore) GetApplicationMemberRole(ctx context.Context, appID, userID uuid.UUID) (string, error) {
	var role string
	err := s.db.QueryRowContext(ctx, `
		SELECT role FROM application_members
		WHERE application_id = $1 AND user_id = $2`, appID, userID,
	).Scan(&role)
	if err == sql.ErrNoRows {
		return "", domain.ErrApplicationAccessDenied
	}
	return role, err
}
