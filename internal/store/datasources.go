package store

import (
	"context"
	"database/sql"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/google/uuid"
)

// CreateDatasource creates a new datasource record
func (s *PostgresStore) CreateDatasource(ctx context.Context, ds *domain.Datasource) error {
	query := `
		INSERT INTO datasources (id, application_id, name, base_url, auth_type, auth_config, endpoints, active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	_, err := s.db.ExecContext(ctx, query,
		ds.ID, ds.ApplicationID, ds.Name, ds.BaseURL, ds.AuthType,
		ds.AuthConfig, ds.Endpoints, ds.Active,
		ds.CreatedAt, ds.UpdatedAt,
	)
	return err
}

// GetDatasourceByName retrieves a datasource by name
func (s *PostgresStore) GetDatasourceByName(ctx context.Context, appID uuid.UUID, name string) (*domain.Datasource, error) {
	query := `
		SELECT id, application_id, name, base_url, auth_type, auth_config, endpoints, active, created_at, updated_at
		FROM datasources
		WHERE name = $1 AND application_id = $2
	`

	var ds domain.Datasource
	err := s.db.QueryRowContext(ctx, query, name, appID).Scan(
		&ds.ID, &ds.ApplicationID, &ds.Name, &ds.BaseURL, &ds.AuthType,
		&ds.AuthConfig, &ds.Endpoints, &ds.Active,
		&ds.CreatedAt, &ds.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, domain.ErrDatasourceNotFound
	}

	return &ds, err
}

// GetDatasourceByID retrieves a datasource by ID
func (s *PostgresStore) GetDatasourceByID(ctx context.Context, appID uuid.UUID, id uuid.UUID) (*domain.Datasource, error) {
	// Note: in models, the struct is called Datasource, but let's check the return type.
	// Oh wait! The signature in original datasources.go was:
	// func (s *PostgresStore) GetDatasourceByID(ctx context.Context, id uuid.UUID) (*domain.Datasource, error)
	// Let's use `*domain.Datasource` as return type.
	query := `
		SELECT id, application_id, name, base_url, auth_type, auth_config, endpoints, active, created_at, updated_at
		FROM datasources
		WHERE id = $1 AND application_id = $2
	`

	var ds domain.Datasource
	err := s.db.QueryRowContext(ctx, query, id, appID).Scan(
		&ds.ID, &ds.ApplicationID, &ds.Name, &ds.BaseURL, &ds.AuthType,
		&ds.AuthConfig, &ds.Endpoints, &ds.Active,
		&ds.CreatedAt, &ds.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, domain.ErrDatasourceNotFound
	}

	return &ds, err
}

// ListDatasources lists all active datasources for an application
func (s *PostgresStore) ListDatasources(ctx context.Context, appID uuid.UUID) ([]domain.Datasource, error) {
	query := `
		SELECT id, application_id, name, base_url, auth_type, endpoints, active, created_at, updated_at
		FROM datasources
		WHERE active = true AND application_id = $1
		ORDER BY name
	`

	rows, err := s.db.QueryContext(ctx, query, appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var datasources []domain.Datasource
	for rows.Next() {
		var ds domain.Datasource
		err := rows.Scan(
			&ds.ID, &ds.ApplicationID, &ds.Name, &ds.BaseURL, &ds.AuthType,
			&ds.Endpoints, &ds.Active, &ds.CreatedAt, &ds.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		datasources = append(datasources, ds)
	}

	return datasources, rows.Err()
}

// UpdateDatasource updates an existing datasource
func (s *PostgresStore) UpdateDatasource(ctx context.Context, appID uuid.UUID, ds *domain.Datasource) error {
	query := `
		UPDATE datasources
		SET name = $3, base_url = $4, auth_type = $5, auth_config = $6, 
		    endpoints = $7, active = $8, updated_at = $9
		WHERE id = $1 AND application_id = $2
	`

	_, err := s.db.ExecContext(ctx, query,
		ds.ID, appID, ds.Name, ds.BaseURL, ds.AuthType,
		ds.AuthConfig, ds.Endpoints, ds.Active, ds.UpdatedAt,
	)
	return err
}

// DeleteDatasource soft-deletes a datasource by setting active to false
func (s *PostgresStore) DeleteDatasource(ctx context.Context, appID uuid.UUID, id uuid.UUID) error {
	query := `
		UPDATE datasources
		SET active = false, updated_at = NOW()
		WHERE id = $1 AND application_id = $2
	`

	_, err := s.db.ExecContext(ctx, query, id, appID)
	return err
}
