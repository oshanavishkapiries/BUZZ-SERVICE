package store

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
)

// DeviceToken represents a device token for push notifications
type DeviceToken struct {
	ID         uuid.UUID
	UserID     string
	Token      string
	Platform   string // android, ios, web
	Active     bool
	LastUsedAt time.Time
	CreatedAt  time.Time
}

// UpsertDeviceToken inserts or updates a device token
func (s *PostgresStore) UpsertDeviceToken(ctx context.Context, token *DeviceToken) error {
	query := `
		INSERT INTO device_tokens (id, user_id, token, platform, is_active, last_used_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (token) 
		DO UPDATE SET 
			user_id = EXCLUDED.user_id,
			platform = EXCLUDED.platform,
			is_active = EXCLUDED.is_active,
			last_used_at = NOW()
	`

	_, err := s.db.ExecContext(ctx, query,
		token.ID, token.UserID, token.Token, token.Platform, token.Active,
	)
	return err
}

// GetUserDeviceTokens retrieves all active device tokens for a user
func (s *PostgresStore) GetUserDeviceTokens(ctx context.Context, userID string) ([]DeviceToken, error) {
	query := `
		SELECT id, user_id, token, platform, is_active, last_used_at, created_at
		FROM device_tokens
		WHERE user_id = $1 AND is_active = true AND deleted_at IS NULL
		ORDER BY last_used_at DESC
	`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tokens []DeviceToken
	for rows.Next() {
		var token DeviceToken
		var lastUsedAt sql.NullTime
		err := rows.Scan(
			&token.ID, &token.UserID, &token.Token, &token.Platform,
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

// DeactivateDeviceToken marks a device token as inactive
func (s *PostgresStore) DeactivateDeviceToken(ctx context.Context, token string) error {
	query := "UPDATE device_tokens SET is_active = false WHERE token = $1"
	_, err := s.db.ExecContext(ctx, query, token)
	return err
}

// GetDeviceToken retrieves a single device token by token string
func (s *PostgresStore) GetDeviceToken(ctx context.Context, token string) (*DeviceToken, error) {
	query := `
		SELECT id, user_id, token, platform, is_active, last_used_at, created_at
		FROM device_tokens
		WHERE token = $1 AND deleted_at IS NULL
	`

	var dt DeviceToken
	var lastUsedAt sql.NullTime
	err := s.db.QueryRowContext(ctx, query, token).Scan(
		&dt.ID, &dt.UserID, &dt.Token, &dt.Platform,
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
