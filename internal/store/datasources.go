package store

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/ediflix/buzz-service/internal/domain"
	"github.com/google/uuid"
)

// DatasourceRepository handles database operations for datasources
type DatasourceRepository struct {
	db *sql.DB
}

// NewDatasourceRepository creates a new datasource repository
func NewDatasourceRepository(db *sql.DB) *DatasourceRepository {
	return &DatasourceRepository{db: db}
}

// Create creates a new datasource
func (r *DatasourceRepository) Create(ctx context.Context, datasource *domain.Datasource) error {
	query := `
		INSERT INTO datasources (
			id, name, type, config, column_mapping, created_by
		) VALUES (
			$1, $2, $3, $4, $5, $6
		) RETURNING created_at, updated_at
	`

	datasource.ID = uuid.New()

	err := r.db.QueryRowContext(ctx, query,
		datasource.ID, datasource.Name, datasource.Type, datasource.Config,
		datasource.ColumnMapping, datasource.CreatedBy,
	).Scan(&datasource.CreatedAt, &datasource.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create datasource: %w", err)
	}

	return nil
}

// GetByID retrieves a datasource by ID
func (r *DatasourceRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Datasource, error) {
	query := `
		SELECT id, name, type, config, column_mapping, created_at, updated_at,
			created_by, deleted_at
		FROM datasources
		WHERE id = $1 AND deleted_at IS NULL
	`

	datasource := &domain.Datasource{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&datasource.ID, &datasource.Name, &datasource.Type, &datasource.Config,
		&datasource.ColumnMapping, &datasource.CreatedAt, &datasource.UpdatedAt,
		&datasource.CreatedBy, &datasource.DeletedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("datasource not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get datasource: %w", err)
	}

	return datasource, nil
}

// GetByName retrieves a datasource by name
func (r *DatasourceRepository) GetByName(ctx context.Context, name string) (*domain.Datasource, error) {
	query := `
		SELECT id, name, type, config, column_mapping, created_at, updated_at,
			created_by, deleted_at
		FROM datasources
		WHERE name = $1 AND deleted_at IS NULL
	`

	datasource := &domain.Datasource{}
	err := r.db.QueryRowContext(ctx, query, name).Scan(
		&datasource.ID, &datasource.Name, &datasource.Type, &datasource.Config,
		&datasource.ColumnMapping, &datasource.CreatedAt, &datasource.UpdatedAt,
		&datasource.CreatedBy, &datasource.DeletedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("datasource not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get datasource: %w", err)
	}

	return datasource, nil
}

// Update updates an existing datasource
func (r *DatasourceRepository) Update(ctx context.Context, datasource *domain.Datasource) error {
	query := `
		UPDATE datasources SET
			name = $1, type = $2, config = $3, column_mapping = $4, updated_at = NOW()
		WHERE id = $5 AND deleted_at IS NULL
		RETURNING updated_at
	`

	err := r.db.QueryRowContext(ctx, query,
		datasource.Name, datasource.Type, datasource.Config, datasource.ColumnMapping,
		datasource.ID,
	).Scan(&datasource.UpdatedAt)

	if err == sql.ErrNoRows {
		return fmt.Errorf("datasource not found")
	}
	if err != nil {
		return fmt.Errorf("failed to update datasource: %w", err)
	}

	return nil
}

// List retrieves datasources with optional filters
func (r *DatasourceRepository) List(ctx context.Context, filters map[string]interface{}, limit, offset int) ([]*domain.Datasource, error) {
	query := `
		SELECT id, name, type, config, column_mapping, created_at, updated_at,
			created_by, deleted_at
		FROM datasources
		WHERE deleted_at IS NULL
	`

	args := []interface{}{}
	argIndex := 1

	// Add filters
	if dsType, ok := filters["type"].(domain.DatasourceType); ok {
		query += fmt.Sprintf(" AND type = $%d", argIndex)
		args = append(args, dsType)
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
		return nil, fmt.Errorf("failed to list datasources: %w", err)
	}
	defer rows.Close()

	datasources := []*domain.Datasource{}
	for rows.Next() {
		datasource := &domain.Datasource{}
		err := rows.Scan(
			&datasource.ID, &datasource.Name, &datasource.Type, &datasource.Config,
			&datasource.ColumnMapping, &datasource.CreatedAt, &datasource.UpdatedAt,
			&datasource.CreatedBy, &datasource.DeletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan datasource: %w", err)
		}
		datasources = append(datasources, datasource)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating datasources: %w", err)
	}

	return datasources, nil
}

// Delete soft deletes a datasource
func (r *DatasourceRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE datasources SET
			deleted_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete datasource: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("datasource not found")
	}

	return nil
}
