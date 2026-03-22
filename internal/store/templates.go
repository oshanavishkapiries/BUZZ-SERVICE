package store

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/ediflix/buzz-service/internal/domain"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// TemplateRepository handles database operations for templates
type TemplateRepository struct {
	db *sql.DB
}

// NewTemplateRepository creates a new template repository
func NewTemplateRepository(db *sql.DB) *TemplateRepository {
	return &TemplateRepository{db: db}
}

// Create creates a new template
func (r *TemplateRepository) Create(ctx context.Context, template *domain.Template) error {
	query := `
		INSERT INTO templates (
			id, name, description, channels, subject, body, html_body,
			variables, default_values, config, is_active, created_by
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
		) RETURNING created_at, updated_at
	`

	template.ID = uuid.New()

	err := r.db.QueryRowContext(ctx, query,
		template.ID, template.Name, template.Description, pq.Array(template.Channels),
		template.Subject, template.Body, template.HTMLBody, pq.Array(template.Variables),
		template.DefaultValues, template.Config, template.IsActive, template.CreatedBy,
	).Scan(&template.CreatedAt, &template.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create template: %w", err)
	}

	return nil
}

// GetByID retrieves a template by ID
func (r *TemplateRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Template, error) {
	query := `
		SELECT id, name, description, channels, subject, body, html_body,
			variables, default_values, config, is_active, created_at, updated_at,
			created_by, deleted_at
		FROM templates
		WHERE id = $1 AND deleted_at IS NULL
	`

	template := &domain.Template{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&template.ID, &template.Name, &template.Description, pq.Array(&template.Channels),
		&template.Subject, &template.Body, &template.HTMLBody, pq.Array(&template.Variables),
		&template.DefaultValues, &template.Config, &template.IsActive, &template.CreatedAt,
		&template.UpdatedAt, &template.CreatedBy, &template.DeletedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("template not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get template: %w", err)
	}

	return template, nil
}

// GetByName retrieves a template by name
func (r *TemplateRepository) GetByName(ctx context.Context, name string) (*domain.Template, error) {
	query := `
		SELECT id, name, description, channels, subject, body, html_body,
			variables, default_values, config, is_active, created_at, updated_at,
			created_by, deleted_at
		FROM templates
		WHERE name = $1 AND deleted_at IS NULL
	`

	template := &domain.Template{}
	err := r.db.QueryRowContext(ctx, query, name).Scan(
		&template.ID, &template.Name, &template.Description, pq.Array(&template.Channels),
		&template.Subject, &template.Body, &template.HTMLBody, pq.Array(&template.Variables),
		&template.DefaultValues, &template.Config, &template.IsActive, &template.CreatedAt,
		&template.UpdatedAt, &template.CreatedBy, &template.DeletedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("template not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get template: %w", err)
	}

	return template, nil
}

// Update updates an existing template
func (r *TemplateRepository) Update(ctx context.Context, template *domain.Template) error {
	query := `
		UPDATE templates SET
			name = $1, description = $2, channels = $3, subject = $4, body = $5,
			html_body = $6, variables = $7, default_values = $8, config = $9,
			is_active = $10, updated_at = NOW()
		WHERE id = $11 AND deleted_at IS NULL
		RETURNING updated_at
	`

	err := r.db.QueryRowContext(ctx, query,
		template.Name, template.Description, pq.Array(template.Channels), template.Subject,
		template.Body, template.HTMLBody, pq.Array(template.Variables), template.DefaultValues,
		template.Config, template.IsActive, template.ID,
	).Scan(&template.UpdatedAt)

	if err == sql.ErrNoRows {
		return fmt.Errorf("template not found")
	}
	if err != nil {
		return fmt.Errorf("failed to update template: %w", err)
	}

	return nil
}

// List retrieves templates with optional filters
func (r *TemplateRepository) List(ctx context.Context, filters map[string]interface{}, limit, offset int) ([]*domain.Template, error) {
	query := `
		SELECT id, name, description, channels, subject, body, html_body,
			variables, default_values, config, is_active, created_at, updated_at,
			created_by, deleted_at
		FROM templates
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
	if channel, ok := filters["channel"].(string); ok {
		query += fmt.Sprintf(" AND $%d = ANY(channels)", argIndex)
		args = append(args, channel)
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
		return nil, fmt.Errorf("failed to list templates: %w", err)
	}
	defer rows.Close()

	templates := []*domain.Template{}
	for rows.Next() {
		template := &domain.Template{}
		err := rows.Scan(
			&template.ID, &template.Name, &template.Description, pq.Array(&template.Channels),
			&template.Subject, &template.Body, &template.HTMLBody, pq.Array(&template.Variables),
			&template.DefaultValues, &template.Config, &template.IsActive, &template.CreatedAt,
			&template.UpdatedAt, &template.CreatedBy, &template.DeletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan template: %w", err)
		}
		templates = append(templates, template)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating templates: %w", err)
	}

	return templates, nil
}

// Delete soft deletes a template
func (r *TemplateRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE templates SET
			deleted_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete template: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("template not found")
	}

	return nil
}
