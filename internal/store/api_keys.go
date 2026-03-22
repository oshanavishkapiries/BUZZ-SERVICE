package store

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/ediflix/buzz-service/internal/domain"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// APIKeyRepository handles database operations for API keys
type APIKeyRepository struct {
	db *sql.DB
}

// NewAPIKeyRepository creates a new API key repository
func NewAPIKeyRepository(db *sql.DB) *APIKeyRepository {
	return &APIKeyRepository{db: db}
}

// Create creates a new API key
func (r *APIKeyRepository) Create(ctx context.Context, apiKey *domain.APIKey) error {
	query := `
		INSERT INTO api_keys (
			id, name, description, key_hash, key_prefix, environment, scopes,
			rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
			allowed_ips, is_active, expires_at, metadata, created_by
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
		) RETURNING created_at, updated_at
	`

	apiKey.ID = uuid.New()

	err := r.db.QueryRowContext(ctx, query,
		apiKey.ID, apiKey.Name, apiKey.Description, apiKey.KeyHash, apiKey.KeyPrefix,
		apiKey.Environment, pq.Array(apiKey.Scopes), apiKey.RateLimitPerMinute,
		apiKey.RateLimitPerHour, apiKey.RateLimitPerDay, pq.Array(apiKey.AllowedIPs),
		apiKey.IsActive, apiKey.ExpiresAt, apiKey.Metadata, apiKey.CreatedBy,
	).Scan(&apiKey.CreatedAt, &apiKey.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create API key: %w", err)
	}

	return nil
}

// GetByID retrieves an API key by ID
func (r *APIKeyRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.APIKey, error) {
	query := `
		SELECT id, name, description, key_hash, key_prefix, environment, scopes,
			rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
			last_used_at, usage_count, allowed_ips, is_active, expires_at,
			metadata, created_at, updated_at, created_by, deleted_at
		FROM api_keys
		WHERE id = $1 AND deleted_at IS NULL
	`

	apiKey := &domain.APIKey{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&apiKey.ID, &apiKey.Name, &apiKey.Description, &apiKey.KeyHash, &apiKey.KeyPrefix,
		&apiKey.Environment, pq.Array(&apiKey.Scopes), &apiKey.RateLimitPerMinute,
		&apiKey.RateLimitPerHour, &apiKey.RateLimitPerDay, &apiKey.LastUsedAt,
		&apiKey.UsageCount, pq.Array(&apiKey.AllowedIPs), &apiKey.IsActive,
		&apiKey.ExpiresAt, &apiKey.Metadata, &apiKey.CreatedAt, &apiKey.UpdatedAt,
		&apiKey.CreatedBy, &apiKey.DeletedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("API key not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get API key: %w", err)
	}

	return apiKey, nil
}

// GetByKeyHash retrieves an API key by its hash
func (r *APIKeyRepository) GetByKeyHash(ctx context.Context, keyHash string) (*domain.APIKey, error) {
	query := `
		SELECT id, name, description, key_hash, key_prefix, environment, scopes,
			rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
			last_used_at, usage_count, allowed_ips, is_active, expires_at,
			metadata, created_at, updated_at, created_by, deleted_at
		FROM api_keys
		WHERE key_hash = $1 AND is_active = true AND deleted_at IS NULL
	`

	apiKey := &domain.APIKey{}
	err := r.db.QueryRowContext(ctx, query, keyHash).Scan(
		&apiKey.ID, &apiKey.Name, &apiKey.Description, &apiKey.KeyHash, &apiKey.KeyPrefix,
		&apiKey.Environment, pq.Array(&apiKey.Scopes), &apiKey.RateLimitPerMinute,
		&apiKey.RateLimitPerHour, &apiKey.RateLimitPerDay, &apiKey.LastUsedAt,
		&apiKey.UsageCount, pq.Array(&apiKey.AllowedIPs), &apiKey.IsActive,
		&apiKey.ExpiresAt, &apiKey.Metadata, &apiKey.CreatedAt, &apiKey.UpdatedAt,
		&apiKey.CreatedBy, &apiKey.DeletedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("API key not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get API key: %w", err)
	}

	return apiKey, nil
}

// Update updates an existing API key
func (r *APIKeyRepository) Update(ctx context.Context, apiKey *domain.APIKey) error {
	query := `
		UPDATE api_keys SET
			name = $1, description = $2, scopes = $3, rate_limit_per_minute = $4,
			rate_limit_per_hour = $5, rate_limit_per_day = $6, allowed_ips = $7,
			is_active = $8, expires_at = $9, metadata = $10, updated_at = NOW()
		WHERE id = $11 AND deleted_at IS NULL
		RETURNING updated_at
	`

	err := r.db.QueryRowContext(ctx, query,
		apiKey.Name, apiKey.Description, pq.Array(apiKey.Scopes), apiKey.RateLimitPerMinute,
		apiKey.RateLimitPerHour, apiKey.RateLimitPerDay, pq.Array(apiKey.AllowedIPs),
		apiKey.IsActive, apiKey.ExpiresAt, apiKey.Metadata, apiKey.ID,
	).Scan(&apiKey.UpdatedAt)

	if err == sql.ErrNoRows {
		return fmt.Errorf("API key not found")
	}
	if err != nil {
		return fmt.Errorf("failed to update API key: %w", err)
	}

	return nil
}

// UpdateUsage updates the usage statistics for an API key
func (r *APIKeyRepository) UpdateUsage(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE api_keys SET
			last_used_at = NOW(), usage_count = usage_count + 1, updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to update API key usage: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("API key not found")
	}

	return nil
}

// List retrieves API keys with optional filters
func (r *APIKeyRepository) List(ctx context.Context, filters map[string]interface{}, limit, offset int) ([]*domain.APIKey, error) {
	query := `
		SELECT id, name, description, key_hash, key_prefix, environment, scopes,
			rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
			last_used_at, usage_count, allowed_ips, is_active, expires_at,
			metadata, created_at, updated_at, created_by, deleted_at
		FROM api_keys
		WHERE deleted_at IS NULL
	`

	args := []interface{}{}
	argIndex := 1

	// Add filters
	if isActive, ok := filters["is_active"].(bool); ok {
		query += fmt.Sprintf(" AND is_active = $%d", argIndex)
		args = append(args, isActive)
		argIndex++
	}
	if environment, ok := filters["environment"].(domain.Environment); ok {
		query += fmt.Sprintf(" AND environment = $%d", argIndex)
		args = append(args, environment)
		argIndex++
	}

	query += " ORDER BY created_at DESC"

	if limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIndex)
		args = append(args, limit)
		argIndex++
	}
	if offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIndex)
		args = append(args, offset)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list API keys: %w", err)
	}
	defer rows.Close()

	apiKeys := []*domain.APIKey{}
	for rows.Next() {
		apiKey := &domain.APIKey{}
		err := rows.Scan(
			&apiKey.ID, &apiKey.Name, &apiKey.Description, &apiKey.KeyHash, &apiKey.KeyPrefix,
			&apiKey.Environment, pq.Array(&apiKey.Scopes), &apiKey.RateLimitPerMinute,
			&apiKey.RateLimitPerHour, &apiKey.RateLimitPerDay, &apiKey.LastUsedAt,
			&apiKey.UsageCount, pq.Array(&apiKey.AllowedIPs), &apiKey.IsActive,
			&apiKey.ExpiresAt, &apiKey.Metadata, &apiKey.CreatedAt, &apiKey.UpdatedAt,
			&apiKey.CreatedBy, &apiKey.DeletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan API key: %w", err)
		}
		apiKeys = append(apiKeys, apiKey)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating API keys: %w", err)
	}

	return apiKeys, nil
}

// Delete soft deletes an API key
func (r *APIKeyRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE api_keys SET
			deleted_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete API key: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("API key not found")
	}

	return nil
}
