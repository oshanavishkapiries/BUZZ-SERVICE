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
		INSERT INTO datasources (id, name, base_url, auth_type, auth_config, endpoints, active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	_, err := s.db.ExecContext(ctx, query,
		ds.ID, ds.Name, ds.BaseURL, ds.AuthType,
		ds.AuthConfig, ds.Endpoints, ds.Active,
		ds.CreatedAt, ds.UpdatedAt,
	)
	return err
}

// GetDatasourceByName retrieves a datasource by name
func (s *PostgresStore) GetDatasourceByName(ctx context.Context, name string) (*domain.Datasource, error) {
	query := `
		SELECT id, name, base_url, auth_type, auth_config, endpoints, active, created_at, updated_at
		FROM datasources
		WHERE name = $1
	`

	var ds domain.Datasource
	err := s.db.QueryRowContext(ctx, query, name).Scan(
		&ds.ID, &ds.Name, &ds.BaseURL, &ds.AuthType,
		&ds.AuthConfig, &ds.Endpoints, &ds.Active,
		&ds.CreatedAt, &ds.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, domain.ErrDatasourceNotFound
	}

	return &ds, err
}

// GetDatasourceByID retrieves a datasource by ID
func (s *PostgresStore) GetDatasourceByID(ctx context.Context, id uuid.UUID) (*domain.Datasource, error) {
	query := `
		SELECT id, name, base_url, auth_type, auth_config, endpoints, active, created_at, updated_at
		FROM datasources
		WHERE id = $1
	`

	var ds domain.Datasource
	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&ds.ID, &ds.Name, &ds.BaseURL, &ds.AuthType,
		&ds.AuthConfig, &ds.Endpoints, &ds.Active,
		&ds.CreatedAt, &ds.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, domain.ErrDatasourceNotFound
	}

	return &ds, err
}

// ListDatasources lists all active datasources
func (s *PostgresStore) ListDatasources(ctx context.Context) ([]domain.Datasource, error) {
	query := `
		SELECT id, name, base_url, auth_type, endpoints, active, created_at, updated_at
		FROM datasources
		WHERE active = true
		ORDER BY name
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var datasources []domain.Datasource
	for rows.Next() {
		var ds domain.Datasource
		err := rows.Scan(
			&ds.ID, &ds.Name, &ds.BaseURL, &ds.AuthType,
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
func (s *PostgresStore) UpdateDatasource(ctx context.Context, ds *domain.Datasource) error {
	query := `
		UPDATE datasources
		SET name = $2, base_url = $3, auth_type = $4, auth_config = $5, 
		    endpoints = $6, active = $7, updated_at = $8
		WHERE id = $1
	`

	_, err := s.db.ExecContext(ctx, query,
		ds.ID, ds.Name, ds.BaseURL, ds.AuthType,
		ds.AuthConfig, ds.Endpoints, ds.Active, ds.UpdatedAt,
	)
	return err
}

// DeleteDatasource soft-deletes a datasource by setting active to false
func (s *PostgresStore) DeleteDatasource(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE datasources
		SET active = false, updated_at = NOW()
		WHERE id = $1
	`

	_, err := s.db.ExecContext(ctx, query, id)
	return err
}
