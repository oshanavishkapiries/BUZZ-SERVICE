package store

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/google/uuid"
)

// BatchRepository handles database operations for batches
type BatchRepository struct {
	db *sql.DB
}

// NewBatchRepository creates a new batch repository
func NewBatchRepository(db *sql.DB) *BatchRepository {
	return &BatchRepository{db: db}
}

// Create creates a new batch
func (r *BatchRepository) Create(ctx context.Context, batch *domain.Batch) error {
	query := `
		INSERT INTO batches (
			id, name, description, type, channel, template_id, datasource_id,
			status, total_count, success_count, failed_count, pending_count,
			scheduled_at, config, created_by
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
		) RETURNING created_at, updated_at
	`

	batch.ID = uuid.New()

	err := r.db.QueryRowContext(ctx, query,
		batch.ID, batch.Name, batch.Description, batch.Type, batch.Channel,
		batch.TemplateID, batch.DatasourceID, batch.Status, batch.TotalCount,
		batch.SuccessCount, batch.FailedCount, batch.PendingCount, batch.ScheduledAt,
		batch.Config, batch.CreatedBy,
	).Scan(&batch.CreatedAt, &batch.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create batch: %w", err)
	}

	return nil
}

// GetByID retrieves a batch by ID
func (r *BatchRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Batch, error) {
	query := `
		SELECT id, name, description, type, channel, template_id, datasource_id,
			status, total_count, success_count, failed_count, pending_count,
			scheduled_at, started_at, completed_at, error_message, config,
			created_at, updated_at, created_by, deleted_at
		FROM batches
		WHERE id = $1 AND deleted_at IS NULL
	`

	batch := &domain.Batch{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&batch.ID, &batch.Name, &batch.Description, &batch.Type, &batch.Channel,
		&batch.TemplateID, &batch.DatasourceID, &batch.Status, &batch.TotalCount,
		&batch.SuccessCount, &batch.FailedCount, &batch.PendingCount, &batch.ScheduledAt,
		&batch.StartedAt, &batch.CompletedAt, &batch.ErrorMessage, &batch.Config,
		&batch.CreatedAt, &batch.UpdatedAt, &batch.CreatedBy, &batch.DeletedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("batch not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get batch: %w", err)
	}

	return batch, nil
}

// Update updates an existing batch
func (r *BatchRepository) Update(ctx context.Context, batch *domain.Batch) error {
	query := `
		UPDATE batches SET
			status = $1, total_count = $2, success_count = $3, failed_count = $4,
			pending_count = $5, started_at = $6, completed_at = $7, error_message = $8,
			config = $9, updated_at = NOW()
		WHERE id = $10 AND deleted_at IS NULL
		RETURNING updated_at
	`

	err := r.db.QueryRowContext(ctx, query,
		batch.Status, batch.TotalCount, batch.SuccessCount, batch.FailedCount,
		batch.PendingCount, batch.StartedAt, batch.CompletedAt, batch.ErrorMessage,
		batch.Config, batch.ID,
	).Scan(&batch.UpdatedAt)

	if err == sql.ErrNoRows {
		return fmt.Errorf("batch not found")
	}
	if err != nil {
		return fmt.Errorf("failed to update batch: %w", err)
	}

	return nil
}

// UpdateStatus updates only the status of a batch
func (r *BatchRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status domain.BatchStatus) error {
	query := `
		UPDATE batches SET
			status = $1, updated_at = NOW()
		WHERE id = $2 AND deleted_at IS NULL
	`

	result, err := r.db.ExecContext(ctx, query, status, id)
	if err != nil {
		return fmt.Errorf("failed to update batch status: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("batch not found")
	}

	return nil
}

// UpdateCounters updates the counters for a batch
func (r *BatchRepository) UpdateCounters(ctx context.Context, id uuid.UUID, totalCount, successCount, failedCount, pendingCount int) error {
	query := `
		UPDATE batches SET
			total_count = $1, success_count = $2, failed_count = $3, pending_count = $4,
			updated_at = NOW()
		WHERE id = $5 AND deleted_at IS NULL
	`

	result, err := r.db.ExecContext(ctx, query, totalCount, successCount, failedCount, pendingCount, id)
	if err != nil {
		return fmt.Errorf("failed to update batch counters: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("batch not found")
	}

	return nil
}

// List retrieves batches with optional filters
func (r *BatchRepository) List(ctx context.Context, filters map[string]interface{}, limit, offset int) ([]*domain.Batch, error) {
	query := `
		SELECT id, name, description, type, channel, template_id, datasource_id,
			status, total_count, success_count, failed_count, pending_count,
			scheduled_at, started_at, completed_at, error_message, config,
			created_at, updated_at, created_by, deleted_at
		FROM batches
		WHERE deleted_at IS NULL
	`

	args := []interface{}{}
	argIndex := 1

	// Add filters
	if status, ok := filters["status"].(domain.BatchStatus); ok {
		query += fmt.Sprintf(" AND status = $%d", argIndex)
		args = append(args, status)
		argIndex++
	}
	if channel, ok := filters["channel"].(domain.Channel); ok {
		query += fmt.Sprintf(" AND channel = $%d", argIndex)
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
		return nil, fmt.Errorf("failed to list batches: %w", err)
	}
	defer rows.Close()

	batches := []*domain.Batch{}
	for rows.Next() {
		batch := &domain.Batch{}
		err := rows.Scan(
			&batch.ID, &batch.Name, &batch.Description, &batch.Type, &batch.Channel,
			&batch.TemplateID, &batch.DatasourceID, &batch.Status, &batch.TotalCount,
			&batch.SuccessCount, &batch.FailedCount, &batch.PendingCount, &batch.ScheduledAt,
			&batch.StartedAt, &batch.CompletedAt, &batch.ErrorMessage, &batch.Config,
			&batch.CreatedAt, &batch.UpdatedAt, &batch.CreatedBy, &batch.DeletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan batch: %w", err)
		}
		batches = append(batches, batch)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating batches: %w", err)
	}

	return batches, nil
}

// Delete soft deletes a batch
func (r *BatchRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE batches SET
			deleted_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete batch: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("batch not found")
	}

	return nil
}
