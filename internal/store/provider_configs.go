package store

import (
	"context"
	"database/sql"
	"time"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/google/uuid"
)

func (s *PostgresStore) CreateProviderConfig(ctx context.Context, pc *domain.ProviderConfig) error {
	// If this is being set as default, clear the existing default for that channel first
	if pc.IsDefault {
		if err := s.clearDefaultProvider(ctx, pc.Channel, uuid.Nil); err != nil {
			return err
		}
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO provider_configs (id, name, channel, provider, config, is_default, is_active, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		pc.ID, pc.Name, pc.Channel, pc.Provider, pc.Config,
		pc.IsDefault, pc.IsActive, pc.CreatedAt, pc.UpdatedAt,
	)
	return err
}

func (s *PostgresStore) GetProviderConfigByID(ctx context.Context, id uuid.UUID) (*domain.ProviderConfig, error) {
	var pc domain.ProviderConfig
	err := s.db.QueryRowContext(ctx, `
		SELECT id, name, channel, provider, config, is_default, is_active, created_at, updated_at
		FROM provider_configs WHERE id = $1`, id,
	).Scan(&pc.ID, &pc.Name, &pc.Channel, &pc.Provider, &pc.Config,
		&pc.IsDefault, &pc.IsActive, &pc.CreatedAt, &pc.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, domain.ErrProviderConfigNotFound
	}
	return &pc, err
}

func (s *PostgresStore) GetProviderConfigByName(ctx context.Context, name string) (*domain.ProviderConfig, error) {
	var pc domain.ProviderConfig
	err := s.db.QueryRowContext(ctx, `
		SELECT id, name, channel, provider, config, is_default, is_active, created_at, updated_at
		FROM provider_configs WHERE name = $1`, name,
	).Scan(&pc.ID, &pc.Name, &pc.Channel, &pc.Provider, &pc.Config,
		&pc.IsDefault, &pc.IsActive, &pc.CreatedAt, &pc.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, domain.ErrProviderConfigNotFound
	}
	return &pc, err
}

func (s *PostgresStore) GetDefaultProviderConfig(ctx context.Context, channel domain.Channel) (*domain.ProviderConfig, error) {
	var pc domain.ProviderConfig
	err := s.db.QueryRowContext(ctx, `
		SELECT id, name, channel, provider, config, is_default, is_active, created_at, updated_at
		FROM provider_configs
		WHERE channel = $1 AND is_active = true
		ORDER BY is_default DESC, created_at ASC
		LIMIT 1`, channel,
	).Scan(&pc.ID, &pc.Name, &pc.Channel, &pc.Provider, &pc.Config,
		&pc.IsDefault, &pc.IsActive, &pc.CreatedAt, &pc.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, domain.ErrProviderConfigNotFound
	}
	return &pc, err
}

func (s *PostgresStore) ListProviderConfigs(ctx context.Context) ([]domain.ProviderConfig, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, channel, provider, config, is_default, is_active, created_at, updated_at
		FROM provider_configs
		ORDER BY channel, is_default DESC, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.ProviderConfig
	for rows.Next() {
		var pc domain.ProviderConfig
		if err := rows.Scan(&pc.ID, &pc.Name, &pc.Channel, &pc.Provider, &pc.Config,
			&pc.IsDefault, &pc.IsActive, &pc.CreatedAt, &pc.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, pc)
	}
	return out, rows.Err()
}

func (s *PostgresStore) UpdateProviderConfig(ctx context.Context, pc *domain.ProviderConfig) error {
	if pc.IsDefault {
		if err := s.clearDefaultProvider(ctx, pc.Channel, pc.ID); err != nil {
			return err
		}
	}
	pc.UpdatedAt = time.Now()
	_, err := s.db.ExecContext(ctx, `
		UPDATE provider_configs
		SET name=$2, config=$3, is_default=$4, is_active=$5, updated_at=$6
		WHERE id=$1`,
		pc.ID, pc.Name, pc.Config, pc.IsDefault, pc.IsActive, pc.UpdatedAt,
	)
	return err
}

func (s *PostgresStore) DeleteProviderConfig(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM provider_configs WHERE id=$1`, id)
	return err
}

// clearDefaultProvider unsets is_default for all providers in a channel except the given ID.
func (s *PostgresStore) clearDefaultProvider(ctx context.Context, channel domain.Channel, exceptID uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE provider_configs SET is_default=false
		WHERE channel=$1 AND id != $2`, channel, exceptID)
	return err
}
