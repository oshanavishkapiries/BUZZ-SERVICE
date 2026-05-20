package store

import (
	"context"
	"database/sql"
	"time"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/google/uuid"
)

func (s *PostgresStore) CreateProviderConfig(ctx context.Context, pc *domain.ProviderConfig) error {
	// If this is being set as default, clear the existing default for that channel first for this app
	if pc.IsDefault {
		if err := s.clearDefaultProvider(ctx, pc.ApplicationID, pc.Channel, uuid.Nil); err != nil {
			return err
		}
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO provider_configs (id, application_id, name, channel, provider, config, is_default, is_active, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		pc.ID, pc.ApplicationID, pc.Name, pc.Channel, pc.Provider, pc.Config,
		pc.IsDefault, pc.IsActive, pc.CreatedAt, pc.UpdatedAt,
	)
	return err
}

func (s *PostgresStore) GetProviderConfigByID(ctx context.Context, appID uuid.UUID, id uuid.UUID) (*domain.ProviderConfig, error) {
	var pc domain.ProviderConfig
	err := s.db.QueryRowContext(ctx, `
		SELECT id, application_id, name, channel, provider, config, is_default, is_active, created_at, updated_at
		FROM provider_configs WHERE id = $1 AND application_id = $2`, id, appID,
	).Scan(&pc.ID, &pc.ApplicationID, &pc.Name, &pc.Channel, &pc.Provider, &pc.Config,
		&pc.IsDefault, &pc.IsActive, &pc.CreatedAt, &pc.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, domain.ErrProviderConfigNotFound
	}
	return &pc, err
}

func (s *PostgresStore) GetProviderConfigByName(ctx context.Context, appID uuid.UUID, name string) (*domain.ProviderConfig, error) {
	var pc domain.ProviderConfig
	err := s.db.QueryRowContext(ctx, `
		SELECT id, application_id, name, channel, provider, config, is_default, is_active, created_at, updated_at
		FROM provider_configs WHERE name = $1 AND application_id = $2`, name, appID,
	).Scan(&pc.ID, &pc.ApplicationID, &pc.Name, &pc.Channel, &pc.Provider, &pc.Config,
		&pc.IsDefault, &pc.IsActive, &pc.CreatedAt, &pc.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, domain.ErrProviderConfigNotFound
	}
	return &pc, err
}

func (s *PostgresStore) GetDefaultProviderConfig(ctx context.Context, appID uuid.UUID, channel domain.Channel) (*domain.ProviderConfig, error) {
	var pc domain.ProviderConfig
	err := s.db.QueryRowContext(ctx, `
		SELECT id, application_id, name, channel, provider, config, is_default, is_active, created_at, updated_at
		FROM provider_configs
		WHERE channel = $1 AND application_id = $2 AND is_active = true
		ORDER BY is_default DESC, created_at ASC
		LIMIT 1`, channel, appID,
	).Scan(&pc.ID, &pc.ApplicationID, &pc.Name, &pc.Channel, &pc.Provider, &pc.Config,
		&pc.IsDefault, &pc.IsActive, &pc.CreatedAt, &pc.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, domain.ErrProviderConfigNotFound
	}
	return &pc, err
}

func (s *PostgresStore) ListProviderConfigs(ctx context.Context, appID uuid.UUID) ([]domain.ProviderConfig, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, application_id, name, channel, provider, config, is_default, is_active, created_at, updated_at
		FROM provider_configs
		WHERE application_id = $1
		ORDER BY channel, is_default DESC, name`, appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.ProviderConfig
	for rows.Next() {
		var pc domain.ProviderConfig
		if err := rows.Scan(&pc.ID, &pc.ApplicationID, &pc.Name, &pc.Channel, &pc.Provider, &pc.Config,
			&pc.IsDefault, &pc.IsActive, &pc.CreatedAt, &pc.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, pc)
	}
	return out, rows.Err()
}

func (s *PostgresStore) ListAllProviderConfigs(ctx context.Context) ([]domain.ProviderConfig, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, application_id, name, channel, provider, config, is_default, is_active, created_at, updated_at
		FROM provider_configs
		ORDER BY application_id, channel, is_default DESC, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.ProviderConfig
	for rows.Next() {
		var pc domain.ProviderConfig
		if err := rows.Scan(&pc.ID, &pc.ApplicationID, &pc.Name, &pc.Channel, &pc.Provider, &pc.Config,
			&pc.IsDefault, &pc.IsActive, &pc.CreatedAt, &pc.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, pc)
	}
	return out, rows.Err()
}

func (s *PostgresStore) UpdateProviderConfig(ctx context.Context, appID uuid.UUID, pc *domain.ProviderConfig) error {
	if pc.IsDefault {
		if err := s.clearDefaultProvider(ctx, appID, pc.Channel, pc.ID); err != nil {
			return err
		}
	}
	pc.UpdatedAt = time.Now()
	_, err := s.db.ExecContext(ctx, `
		UPDATE provider_configs
		SET name=$3, config=$4, is_default=$5, is_active=$6, updated_at=$7
		WHERE id=$1 AND application_id=$2`,
		pc.ID, appID, pc.Name, pc.Config, pc.IsDefault, pc.IsActive, pc.UpdatedAt,
	)
	return err
}

func (s *PostgresStore) DeleteProviderConfig(ctx context.Context, appID uuid.UUID, id uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM provider_configs WHERE id=$1 AND application_id=$2`, id, appID)
	return err
}

// clearDefaultProvider unsets is_default for all providers in a channel except the given ID for an app.
func (s *PostgresStore) clearDefaultProvider(ctx context.Context, appID uuid.UUID, channel domain.Channel, exceptID uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE provider_configs SET is_default=false
		WHERE channel=$1 AND application_id=$2 AND id != $3`, channel, appID, exceptID)
	return err
}
