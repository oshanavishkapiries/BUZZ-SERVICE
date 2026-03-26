package store

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/elight/buzz-service/internal/domain"
	"github.com/google/uuid"
)

// InboxRepository handles database operations for inbox entries
type InboxRepository struct {
	db *sql.DB
}

// NewInboxRepository creates a new inbox repository
func NewInboxRepository(db *sql.DB) *InboxRepository {
	return &InboxRepository{db: db}
}

// Create creates a new inbox entry
func (r *InboxRepository) Create(ctx context.Context, entry *domain.InboxEntry) error {
	query := `
		INSERT INTO inbox (
			id, user_id, notification_id, title, body, type, action_url,
			action_text, icon_url, image_url, is_read, is_archived, expires_at, metadata
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
		) RETURNING created_at, updated_at
	`

	entry.ID = uuid.New()

	err := r.db.QueryRowContext(ctx, query,
		entry.ID, entry.UserID, entry.NotificationID, entry.Title, entry.Body,
		entry.Type, entry.ActionURL, entry.ActionText, entry.IconURL, entry.ImageURL,
		entry.IsRead, entry.IsArchived, entry.ExpiresAt, entry.Metadata,
	).Scan(&entry.CreatedAt, &entry.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create inbox entry: %w", err)
	}

	return nil
}

// GetByID retrieves an inbox entry by ID
func (r *InboxRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.InboxEntry, error) {
	query := `
		SELECT id, user_id, notification_id, title, body, type, action_url,
			action_text, icon_url, image_url, is_read, is_archived, read_at,
			archived_at, expires_at, metadata, created_at, updated_at, deleted_at
		FROM inbox
		WHERE id = $1 AND deleted_at IS NULL
	`

	entry := &domain.InboxEntry{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&entry.ID, &entry.UserID, &entry.NotificationID, &entry.Title, &entry.Body,
		&entry.Type, &entry.ActionURL, &entry.ActionText, &entry.IconURL, &entry.ImageURL,
		&entry.IsRead, &entry.IsArchived, &entry.ReadAt, &entry.ArchivedAt, &entry.ExpiresAt,
		&entry.Metadata, &entry.CreatedAt, &entry.UpdatedAt, &entry.DeletedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("inbox entry not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get inbox entry: %w", err)
	}

	return entry, nil
}

// GetUserInbox retrieves inbox entries for a specific user
func (r *InboxRepository) GetUserInbox(ctx context.Context, userID string, includeArchived bool, limit, offset int) ([]*domain.InboxEntry, error) {
	query := `
		SELECT id, user_id, notification_id, title, body, type, action_url,
			action_text, icon_url, image_url, is_read, is_archived, read_at,
			archived_at, expires_at, metadata, created_at, updated_at, deleted_at
		FROM inbox
		WHERE user_id = $1 AND deleted_at IS NULL
	`

	if !includeArchived {
		query += " AND is_archived = false"
	}

	query += " ORDER BY created_at DESC"

	args := []interface{}{userID}
	argIndex := 2

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
		return nil, fmt.Errorf("failed to get user inbox: %w", err)
	}
	defer rows.Close()

	entries := []*domain.InboxEntry{}
	for rows.Next() {
		entry := &domain.InboxEntry{}
		err := rows.Scan(
			&entry.ID, &entry.UserID, &entry.NotificationID, &entry.Title, &entry.Body,
			&entry.Type, &entry.ActionURL, &entry.ActionText, &entry.IconURL, &entry.ImageURL,
			&entry.IsRead, &entry.IsArchived, &entry.ReadAt, &entry.ArchivedAt, &entry.ExpiresAt,
			&entry.Metadata, &entry.CreatedAt, &entry.UpdatedAt, &entry.DeletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan inbox entry: %w", err)
		}
		entries = append(entries, entry)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating inbox entries: %w", err)
	}

	return entries, nil
}

// GetUnreadCount returns the count of unread messages for a user
func (r *InboxRepository) GetUnreadCount(ctx context.Context, userID string) (int, error) {
	query := `
		SELECT COUNT(*)
		FROM inbox
		WHERE user_id = $1 AND is_read = false AND is_archived = false AND deleted_at IS NULL
	`

	var count int
	err := r.db.QueryRowContext(ctx, query, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to get unread count: %w", err)
	}

	return count, nil
}

// MarkAsRead marks an inbox entry as read
func (r *InboxRepository) MarkAsRead(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE inbox SET
			is_read = true, read_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to mark inbox entry as read: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("inbox entry not found")
	}

	return nil
}

// MarkAllAsRead marks all inbox entries for a user as read
func (r *InboxRepository) MarkAllAsRead(ctx context.Context, userID string) error {
	query := `
		UPDATE inbox SET
			is_read = true, read_at = NOW(), updated_at = NOW()
		WHERE user_id = $1 AND is_read = false AND deleted_at IS NULL
	`

	_, err := r.db.ExecContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to mark all as read: %w", err)
	}

	return nil
}

// Archive archives an inbox entry
func (r *InboxRepository) Archive(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE inbox SET
			is_archived = true, archived_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to archive inbox entry: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("inbox entry not found")
	}

	return nil
}

// Delete soft deletes an inbox entry
func (r *InboxRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE inbox SET
			deleted_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`

	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete inbox entry: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("inbox entry not found")
	}

	return nil
}

// DeleteExpired deletes expired inbox entries
func (r *InboxRepository) DeleteExpired(ctx context.Context) (int64, error) {
	query := `
		UPDATE inbox SET
			deleted_at = NOW()
		WHERE expires_at IS NOT NULL AND expires_at < NOW() AND deleted_at IS NULL
	`

	result, err := r.db.ExecContext(ctx, query)
	if err != nil {
		return 0, fmt.Errorf("failed to delete expired entries: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get rows affected: %w", err)
	}

	return rows, nil
}

// Methods for PostgresStore inbox operations (used by realtime gateway)

// CreateInboxEntry creates a new inbox entry
func (s *PostgresStore) CreateInboxEntry(ctx context.Context, entry *domain.InboxEntry) error {
	query := `
		INSERT INTO inbox (
			id, user_id, notification_id, title, body, type, action_url,
			action_text, icon_url, image_url, is_read, is_archived, expires_at, metadata
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
		) RETURNING created_at
	`

	if entry.ID == uuid.Nil {
		entry.ID = uuid.New()
	}

	err := s.db.QueryRowContext(ctx, query,
		entry.ID, entry.UserID, entry.NotificationID, entry.Title, entry.Body,
		entry.Type, entry.ActionURL, entry.ActionText, entry.IconURL, entry.ImageURL,
		entry.IsRead, entry.IsArchived, entry.ExpiresAt, entry.Metadata,
	).Scan(&entry.CreatedAt)

	if err != nil {
		return fmt.Errorf("failed to create inbox entry: %w", err)
	}

	return nil
}

// GetInbox retrieves inbox entries for a user
type InboxFilters struct {
	UserID     string
	UnreadOnly bool
	Limit      int
	Offset     int
}

func (s *PostgresStore) GetInbox(ctx context.Context, filters InboxFilters) ([]domain.InboxEntry, int, error) {
	query := `
		SELECT id, user_id, notification_id, title, body, type, action_url,
			action_text, icon_url, image_url, is_read, is_archived, read_at,
			archived_at, expires_at, metadata, created_at, updated_at, deleted_at
		FROM inbox
		WHERE user_id = $1 AND deleted_at IS NULL
	`

	args := []interface{}{filters.UserID}
	argCount := 1

	if filters.UnreadOnly {
		query += " AND is_read = false"
	}

	query += " ORDER BY created_at DESC"

	if filters.Limit > 0 {
		argCount++
		query += fmt.Sprintf(" LIMIT $%d", argCount)
		args = append(args, filters.Limit)
	}
	if filters.Offset > 0 {
		argCount++
		query += fmt.Sprintf(" OFFSET $%d", argCount)
		args = append(args, filters.Offset)
	}

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get inbox: %w", err)
	}
	defer rows.Close()

	var entries []domain.InboxEntry
	for rows.Next() {
		var entry domain.InboxEntry
		var readAt, archivedAt, expiresAt, deletedAt sql.NullTime
		err := rows.Scan(
			&entry.ID, &entry.UserID, &entry.NotificationID, &entry.Title, &entry.Body,
			&entry.Type, &entry.ActionURL, &entry.ActionText, &entry.IconURL, &entry.ImageURL,
			&entry.IsRead, &entry.IsArchived, &readAt, &archivedAt, &expiresAt,
			&entry.Metadata, &entry.CreatedAt, &entry.UpdatedAt, &deletedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan inbox entry: %w", err)
		}
		if readAt.Valid {
			entry.ReadAt = &readAt.Time
		}
		if archivedAt.Valid {
			entry.ArchivedAt = &archivedAt.Time
		}
		if expiresAt.Valid {
			entry.ExpiresAt = &expiresAt.Time
		}
		if deletedAt.Valid {
			entry.DeletedAt = &deletedAt.Time
		}
		entries = append(entries, entry)
	}

	// Get total count
	countQuery := "SELECT COUNT(*) FROM inbox WHERE user_id = $1 AND deleted_at IS NULL"
	if filters.UnreadOnly {
		countQuery += " AND is_read = false"
	}

	var total int
	err = s.db.QueryRowContext(ctx, countQuery, filters.UserID).Scan(&total)
	if err != nil {
		return entries, 0, fmt.Errorf("failed to get total count: %w", err)
	}

	return entries, total, nil
}

// GetUnreadCount returns the count of unread messages for a user
func (s *PostgresStore) GetUnreadCount(ctx context.Context, userID string) (int, error) {
	query := `
		SELECT COUNT(*)
		FROM inbox
		WHERE user_id = $1 AND is_read = false AND is_archived = false AND deleted_at IS NULL
	`

	var count int
	err := s.db.QueryRowContext(ctx, query, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to get unread count: %w", err)
	}

	return count, nil
}

// MarkInboxAsRead marks an inbox entry as read
func (s *PostgresStore) MarkInboxAsRead(ctx context.Context, id uuid.UUID, userID string) error {
	query := `
		UPDATE inbox
		SET is_read = true, read_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
	`

	result, err := s.db.ExecContext(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("failed to mark as read: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("inbox entry not found")
	}

	return nil
}

// MarkAllInboxAsRead marks all inbox entries for a user as read
func (s *PostgresStore) MarkAllInboxAsRead(ctx context.Context, userID string) (int, error) {
	query := `
		UPDATE inbox
		SET is_read = true, read_at = NOW(), updated_at = NOW()
		WHERE user_id = $1 AND is_read = false AND deleted_at IS NULL
	`

	result, err := s.db.ExecContext(ctx, query, userID)
	if err != nil {
		return 0, fmt.Errorf("failed to mark all as read: %w", err)
	}

	count, err := result.RowsAffected()
	return int(count), err
}

// DeleteInboxEntry deletes an inbox entry
func (s *PostgresStore) DeleteInboxEntry(ctx context.Context, id uuid.UUID, userID string) error {
	query := `
		UPDATE inbox
		SET deleted_at = NOW()
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
	`

	result, err := s.db.ExecContext(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("failed to delete inbox entry: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("inbox entry not found")
	}

	return nil
}
