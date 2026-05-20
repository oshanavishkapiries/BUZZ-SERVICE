package store

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
)

// DeviceToken represents a device token for push notifications
type DeviceToken struct {
	ID            uuid.UUID
	ApplicationID uuid.UUID
	UserID        string
	Token         string
	Platform      string // android, ios, web
	Active        bool
	LastUsedAt    time.Time
	CreatedAt     time.Time
}

// UpsertDeviceToken inserts or updates a device token
func (s *PostgresStore) UpsertDeviceToken(ctx context.Context, token *DeviceToken) error {
	query := `
		INSERT INTO device_tokens (id, application_id, user_id, token, platform, is_active, last_used_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (token) 
		DO UPDATE SET 
			application_id = EXCLUDED.application_id,
			user_id = EXCLUDED.user_id,
			platform = EXCLUDED.platform,
			is_active = EXCLUDED.is_active,
			last_used_at = NOW()
	`

	_, err := s.db.ExecContext(ctx, query,
		token.ID, token.ApplicationID, token.UserID, token.Token, token.Platform, token.Active,
	)
	return err
}

// GetUserDeviceTokens retrieves all active device tokens for a user within an application
func (s *PostgresStore) GetUserDeviceTokens(ctx context.Context, appID uuid.UUID, userID string) ([]DeviceToken, error) {
	query := `
		SELECT id, application_id, user_id, token, platform, is_active, last_used_at, created_at
		FROM device_tokens
		WHERE user_id = $1 AND application_id = $2 AND is_active = true AND deleted_at IS NULL
		ORDER BY last_used_at DESC
	`

	rows, err := s.db.QueryContext(ctx, query, userID, appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tokens []DeviceToken
	for rows.Next() {
		var token DeviceToken
		var lastUsedAt sql.NullTime
		err := rows.Scan(
			&token.ID, &token.ApplicationID, &token.UserID, &token.Token, &token.Platform,
			&token.Active, &lastUsedAt, &token.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		if lastUsedAt.Valid {
			token.LastUsedAt = lastUsedAt.Time
		}
		tokens = append(tokens, token)
	}

	return tokens, rows.Err()
}

// DeactivateDeviceToken marks a device token as inactive within an application
func (s *PostgresStore) DeactivateDeviceToken(ctx context.Context, appID uuid.UUID, token string) error {
	query := "UPDATE device_tokens SET is_active = false WHERE token = $1 AND application_id = $2"
	_, err := s.db.ExecContext(ctx, query, token, appID)
	return err
}

// GetDeviceToken retrieves a single device token by token string and application ID
func (s *PostgresStore) GetDeviceToken(ctx context.Context, appID uuid.UUID, token string) (*DeviceToken, error) {
	query := `
		SELECT id, application_id, user_id, token, platform, is_active, last_used_at, created_at
		FROM device_tokens
		WHERE token = $1 AND application_id = $2 AND deleted_at IS NULL
	`

	var dt DeviceToken
	var lastUsedAt sql.NullTime
	err := s.db.QueryRowContext(ctx, query, token, appID).Scan(
		&dt.ID, &dt.ApplicationID, &dt.UserID, &dt.Token, &dt.Platform,
		&dt.Active, &lastUsedAt, &dt.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if lastUsedAt.Valid {
		dt.LastUsedAt = lastUsedAt.Time
	}
	return &dt, nil
}
