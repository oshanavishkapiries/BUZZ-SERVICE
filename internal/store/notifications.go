package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/google/uuid"
)

// NotificationRepository handles database operations for notifications
type NotificationRepository struct {
	db *sql.DB
}

// NewNotificationRepository creates a new notification repository
func NewNotificationRepository(db *sql.DB) *NotificationRepository {
	return &NotificationRepository{db: db}
}

// Create creates a new notification
func (r *NotificationRepository) Create(ctx context.Context, notification *domain.Notification) error {
	query := `
		INSERT INTO notifications (
			id, batch_id, channel, priority, recipient, subject, body, html_body,
			template_id, variables, status, provider, provider_message_id, provider_response,
			queued_at, sent_at, delivered_at, failed_at, retry_count, max_retries,
			next_retry_at, error_message, error_code, metadata, created_by
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
			$15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
		) RETURNING created_at, updated_at
	`

	notification.ID = uuid.New()

	err := r.db.QueryRowContext(ctx, query,
		notification.ID, notification.BatchID, notification.Channel, notification.Priority,
		notification.Recipient, notification.Subject, notification.Body, notification.HTMLBody,
		notification.TemplateID, notification.Variables, notification.Status, notification.Provider,
		notification.ProviderMessageID, notification.ProviderResponse, notification.QueuedAt,
		notification.SentAt, notification.DeliveredAt, notification.FailedAt, notification.RetryCount,
		notification.MaxRetries, notification.NextRetryAt, notification.ErrorMessage,
		notification.ErrorCode, notification.Metadata, notification.CreatedBy,
	).Scan(&notification.CreatedAt, &notification.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create notification: %w", err)
	}

	return nil
}

// GetByID retrieves a notification by ID
func (r *NotificationRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Notification, error) {
	query := `
		SELECT id, batch_id, channel, priority, recipient, subject, body, html_body,
			template_id, variables, status, provider, provider_message_id, provider_response,
			queued_at, sent_at, delivered_at, failed_at, retry_count, max_retries,
			next_retry_at, error_message, error_code, metadata, created_at, updated_at,
			created_by, deleted_at
		FROM notifications
		WHERE id = $1 AND deleted_at IS NULL
	`

	notification := &domain.Notification{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&notification.ID, &notification.BatchID, &notification.Channel, &notification.Priority,
		&notification.Recipient, &notification.Subject, &notification.Body, &notification.HTMLBody,
		&notification.TemplateID, &notification.Variables, &notification.Status, &notification.Provider,
		&notification.ProviderMessageID, &notification.ProviderResponse, &notification.QueuedAt,
		&notification.SentAt, &notification.DeliveredAt, &notification.FailedAt, &notification.RetryCount,
		&notification.MaxRetries, &notification.NextRetryAt, &notification.ErrorMessage,
		&notification.ErrorCode, &notification.Metadata, &notification.CreatedAt, &notification.UpdatedAt,
		&notification.CreatedBy, &notification.DeletedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("notification not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get notification: %w", err)
	}

	return notification, nil
}

// Update updates an existing notification
func (r *NotificationRepository) Update(ctx context.Context, notification *domain.Notification) error {
	query := `
		UPDATE notifications SET
			status = $1, provider = $2, provider_message_id = $3, provider_response = $4,
			queued_at = $5, sent_at = $6, delivered_at = $7, failed_at = $8,
			retry_count = $9, next_retry_at = $10, error_message = $11, error_code = $12,
			metadata = $13, updated_at = NOW()
		WHERE id = $14 AND deleted_at IS NULL
		RETURNING updated_at
	`

	err := r.db.QueryRowContext(ctx, query,
		notification.Status, notification.Provider, notification.ProviderMessageID,
		notification.ProviderResponse, notification.QueuedAt, notification.SentAt,
		notification.DeliveredAt, notification.FailedAt, notification.RetryCount,
		notification.NextRetryAt, notification.ErrorMessage, notification.ErrorCode,
		notification.Metadata, notification.ID,
	).Scan(&notification.UpdatedAt)

	if err == sql.ErrNoRows {
		return fmt.Errorf("notification not found")
	}
	if err != nil {
		return fmt.Errorf("failed to update notification: %w", err)
	}

	return nil
}

// UpdateStatus updates only the status of a notification
func (r *NotificationRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status domain.NotificationStatus) error {
	query := `
		UPDATE notifications SET
			status = $1, updated_at = NOW()
		WHERE id = $2 AND deleted_at IS NULL
	`

	result, err := r.db.ExecContext(ctx, query, status, id)
	if err != nil {
		return fmt.Errorf("failed to update notification status: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("notification not found")
	}

	return nil
}

// List retrieves notifications with optional filters
func (r *NotificationRepository) List(ctx context.Context, filters map[string]interface{}, limit, offset int) ([]*domain.Notification, error) {
	query := `
		SELECT id, batch_id, channel, priority, recipient, subject, body, html_body,
			template_id, variables, status, provider, provider_message_id, provider_response,
			queued_at, sent_at, delivered_at, failed_at, retry_count, max_retries,
			next_retry_at, error_message, error_code, metadata, created_at, updated_at,
			created_by, deleted_at
		FROM notifications
		WHERE deleted_at IS NULL
	`

	args := []interface{}{}
	argIndex := 1

	// Add filters
	if batchID, ok := filters["batch_id"].(uuid.UUID); ok {
		query += fmt.Sprintf(" AND batch_id = $%d", argIndex)
		args = append(args, batchID)
		argIndex++
	}
	if channel, ok := filters["channel"].(domain.Channel); ok {
		query += fmt.Sprintf(" AND channel = $%d", argIndex)
		args = append(args, channel)
		argIndex++
	}
	if status, ok := filters["status"].(domain.NotificationStatus); ok {
		query += fmt.Sprintf(" AND status = $%d", argIndex)
		args = append(args, status)
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
		return nil, fmt.Errorf("failed to list notifications: %w", err)
	}
	defer rows.Close()

	notifications := []*domain.Notification{}
	for rows.Next() {
		notification := &domain.Notification{}
		err := rows.Scan(
			&notification.ID, &notification.BatchID, &notification.Channel, &notification.Priority,
			&notification.Recipient, &notification.Subject, &notification.Body, &notification.HTMLBody,
			&notification.TemplateID, &notification.Variables, &notification.Status, &notification.Provider,
			&notification.ProviderMessageID, &notification.ProviderResponse, &notification.QueuedAt,
			&notification.SentAt, &notification.DeliveredAt, &notification.FailedAt, &notification.RetryCount,
			&notification.MaxRetries, &notification.NextRetryAt, &notification.ErrorMessage,
			&notification.ErrorCode, &notification.Metadata, &notification.CreatedAt, &notification.UpdatedAt,
			&notification.CreatedBy, &notification.DeletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan notification: %w", err)
		}
		notifications = append(notifications, notification)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating notifications: %w", err)
	}

	return notifications, nil
}

// GetPendingRetries retrieves notifications that are ready for retry
func (r *NotificationRepository) GetPendingRetries(ctx context.Context, limit int) ([]*domain.Notification, error) {
	query := `
		SELECT id, batch_id, channel, priority, recipient, subject, body, html_body,
			template_id, variables, status, provider, provider_message_id, provider_response,
			queued_at, sent_at, delivered_at, failed_at, retry_count, max_retries,
			next_retry_at, error_message, error_code, metadata, created_at, updated_at,
			created_by, deleted_at
		FROM notifications
		WHERE deleted_at IS NULL
			AND status = $1
			AND retry_count < max_retries
			AND next_retry_at IS NOT NULL
			AND next_retry_at <= $2
		ORDER BY next_retry_at ASC
		LIMIT $3
	`

	rows, err := r.db.QueryContext(ctx, query, domain.StatusFailed, time.Now(), limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get pending retries: %w", err)
	}
	defer rows.Close()

	notifications := []*domain.Notification{}
	for rows.Next() {
		notification := &domain.Notification{}
		err := rows.Scan(
			&notification.ID, &notification.BatchID, &notification.Channel, &notification.Priority,
			&notification.Recipient, &notification.Subject, &notification.Body, &notification.HTMLBody,
			&notification.TemplateID, &notification.Variables, &notification.Status, &notification.Provider,
			&notification.ProviderMessageID, &notification.ProviderResponse, &notification.QueuedAt,
			&notification.SentAt, &notification.DeliveredAt, &notification.FailedAt, &notification.RetryCount,
			&notification.MaxRetries, &notification.NextRetryAt, &notification.ErrorMessage,
			&notification.ErrorCode, &notification.Metadata, &notification.CreatedAt, &notification.UpdatedAt,
			&notification.CreatedBy, &notification.DeletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan notification: %w", err)
		}
		notifications = append(notifications, notification)
	}

	return notifications, nil
}

// MatrixCount holds a count for a channel/status pair
type MatrixCount struct {
	Channel string
	Status  string
	Count   int64
}

// GetMatrix returns counts grouped by channel and status in a single query
func (r *NotificationRepository) GetMatrix(ctx context.Context) ([]MatrixCount, error) {
	query := `
		SELECT channel, status, COUNT(*) AS count
		FROM notifications
		WHERE deleted_at IS NULL
		GROUP BY channel, status
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get notification matrix: %w", err)
	}
	defer rows.Close()

	var counts []MatrixCount
	for rows.Next() {
		var mc MatrixCount
		if err := rows.Scan(&mc.Channel, &mc.Status, &mc.Count); err != nil {
			return nil, fmt.Errorf("failed to scan matrix row: %w", err)
		}
		counts = append(counts, mc)
	}
	return counts, rows.Err()
}

// Delete soft deletes a notification
func (r *NotificationRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE notifications SET
			deleted_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete notification: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("notification not found")
	}

	return nil
}
