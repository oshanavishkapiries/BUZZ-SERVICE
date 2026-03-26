package store

import (
	"context"
	"database/sql"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/google/uuid"
)

// CreateBatch creates a new batch record
func (s *PostgresStore) CreateBatch(ctx context.Context, batch *domain.Batch) error {
	query := `
		INSERT INTO batches (
			id, datasource_id, datasource_name, endpoint_name, endpoint_params,
			template_name, channel, priority, template_data,
			status, idempotency_key, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`

	_, err := s.db.ExecContext(ctx, query,
		batch.ID, batch.DatasourceID, batch.DatasourceName,
		batch.EndpointName, batch.EndpointParams,
		batch.TemplateName, batch.Channel, batch.Priority,
		batch.TemplateData, batch.Status, batch.IdempotencyKey,
		batch.CreatedAt, batch.UpdatedAt,
	)
	return err
}

// GetBatch retrieves a batch by ID
func (s *PostgresStore) GetBatch(ctx context.Context, id uuid.UUID) (*domain.Batch, error) {
	query := `
		SELECT id, datasource_id, datasource_name, endpoint_name, endpoint_params,
		       template_name, channel, priority, template_data,
		       status, total, sent, failed, skipped,
		       idempotency_key, error_message,
		       started_at, completed_at, created_at, updated_at
		FROM batches
		WHERE id = $1
	`

	var batch domain.Batch
	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&batch.ID, &batch.DatasourceID, &batch.DatasourceName,
		&batch.EndpointName, &batch.EndpointParams,
		&batch.TemplateName, &batch.Channel, &batch.Priority,
		&batch.TemplateData, &batch.Status,
		&batch.Total, &batch.Sent, &batch.Failed, &batch.Skipped,
		&batch.IdempotencyKey, &batch.ErrorMessage,
		&batch.StartedAt, &batch.CompletedAt,
		&batch.CreatedAt, &batch.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, domain.ErrBatchNotFound
	}

	return &batch, err
}

// GetBatchByIdempotencyKey retrieves a batch by idempotency key
func (s *PostgresStore) GetBatchByIdempotencyKey(ctx context.Context, key string) (*domain.Batch, error) {
	query := `
		SELECT id, datasource_id, datasource_name, endpoint_name, endpoint_params,
		       template_name, channel, priority, template_data,
		       status, total, sent, failed, skipped,
		       idempotency_key, error_message,
		       started_at, completed_at, created_at, updated_at
		FROM batches
		WHERE idempotency_key = $1
		LIMIT 1
	`

	var batch domain.Batch
	err := s.db.QueryRowContext(ctx, query, key).Scan(
		&batch.ID, &batch.DatasourceID, &batch.DatasourceName,
		&batch.EndpointName, &batch.EndpointParams,
		&batch.TemplateName, &batch.Channel, &batch.Priority,
		&batch.TemplateData, &batch.Status,
		&batch.Total, &batch.Sent, &batch.Failed, &batch.Skipped,
		&batch.IdempotencyKey, &batch.ErrorMessage,
		&batch.StartedAt, &batch.CompletedAt,
		&batch.CreatedAt, &batch.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, domain.ErrBatchNotFound
	}

	return &batch, err
}

// UpdateBatchStatus updates the status of a batch
func (s *PostgresStore) UpdateBatchStatus(ctx context.Context, id uuid.UUID, status domain.BatchStatus) error {
	query := "UPDATE batches SET status = $2, updated_at = NOW() WHERE id = $1"
	_, err := s.db.ExecContext(ctx, query, id, status)
	return err
}

// UpdateBatchTotal updates the total recipient count
func (s *PostgresStore) UpdateBatchTotal(ctx context.Context, id uuid.UUID, total int) error {
	query := "UPDATE batches SET total = $2, updated_at = NOW() WHERE id = $1"
	_, err := s.db.ExecContext(ctx, query, id, total)
	return err
}

// UpdateBatchError updates error message for a batch
func (s *PostgresStore) UpdateBatchError(ctx context.Context, id uuid.UUID, errMsg string) error {
	query := "UPDATE batches SET error_message = $2, status = $3, updated_at = NOW() WHERE id = $1"
	_, err := s.db.ExecContext(ctx, query, id, errMsg, domain.BatchStatusFailed)
	return err
}

// IncrementBatchSent increments the sent count
func (s *PostgresStore) IncrementBatchSent(ctx context.Context, id uuid.UUID) error {
	query := "UPDATE batches SET sent = sent + 1, updated_at = NOW() WHERE id = $1"
	_, err := s.db.ExecContext(ctx, query, id)
	return err
}

// IncrementBatchFailed increments the failed count
func (s *PostgresStore) IncrementBatchFailed(ctx context.Context, id uuid.UUID) error {
	query := "UPDATE batches SET failed = failed + 1, updated_at = NOW() WHERE id = $1"
	_, err := s.db.ExecContext(ctx, query, id)
	return err
}

// IncrementBatchSkipped increments the skipped count
func (s *PostgresStore) IncrementBatchSkipped(ctx context.Context, id uuid.UUID) error {
	query := "UPDATE batches SET skipped = skipped + 1, updated_at = NOW() WHERE id = $1"
	_, err := s.db.ExecContext(ctx, query, id)
	return err
}

// ListBatches lists batches with optional status filter and pagination
func (s *PostgresStore) ListBatches(ctx context.Context, status string, limit, offset int) ([]domain.Batch, int, error) {
	// Get total count
	countQuery := "SELECT COUNT(*) FROM batches"
	var total int
	if status != "" {
		if err := s.db.QueryRowContext(ctx, countQuery+" WHERE status = $1", status).Scan(&total); err != nil {
			return nil, 0, err
		}
	} else {
		if err := s.db.QueryRowContext(ctx, countQuery).Scan(&total); err != nil {
			return nil, 0, err
		}
	}

	// Get batches
	query := `SELECT id, datasource_id, datasource_name, endpoint_name, endpoint_params, 
	         template_name, channel, priority, template_data, status, total, sent, failed, skipped, 
	         idempotency_key, error_message, started_at, completed_at, created_at, updated_at 
	  FROM batches`

	if status != "" {
		query += " WHERE status = $1"
	}

	query += " ORDER BY created_at DESC"

	if limit > 0 && status != "" {
		query += " LIMIT $2"
		if offset > 0 {
			query += " OFFSET $3"
		}
	} else if limit > 0 {
		query += " LIMIT $1"
		if offset > 0 {
			query += " OFFSET $2"
		}
	}

	var rows *sql.Rows
	var err error

	if status != "" && limit > 0 && offset > 0 {
		rows, err = s.db.QueryContext(ctx, query, status, limit, offset)
	} else if status != "" && limit > 0 {
		rows, err = s.db.QueryContext(ctx, query, status, limit)
	} else if limit > 0 && offset > 0 {
		rows, err = s.db.QueryContext(ctx, query, limit, offset)
	} else if status != "" {
		rows, err = s.db.QueryContext(ctx, query, status)
	} else if limit > 0 {
		rows, err = s.db.QueryContext(ctx, query, limit)
	} else {
		rows, err = s.db.QueryContext(ctx, query)
	}

	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	batches := []domain.Batch{}
	for rows.Next() {
		var b domain.Batch
		err := rows.Scan(
			&b.ID, &b.DatasourceID, &b.DatasourceName,
			&b.EndpointName, &b.EndpointParams,
			&b.TemplateName, &b.Channel, &b.Priority,
			&b.TemplateData, &b.Status,
			&b.Total, &b.Sent, &b.Failed, &b.Skipped,
			&b.IdempotencyKey, &b.ErrorMessage,
			&b.StartedAt, &b.CompletedAt,
			&b.CreatedAt, &b.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		batches = append(batches, b)
	}

	return batches, total, rows.Err()
}
