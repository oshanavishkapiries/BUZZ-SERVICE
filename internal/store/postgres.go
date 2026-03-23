package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/elight/buzz-service/internal/config"
	"github.com/elight/buzz-service/internal/domain"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

type PostgresStore struct {
	db *sql.DB
}

func NewPostgresStore(cfg *config.DatabaseConfig) (*PostgresStore, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Name, cfg.SSLMode,
	)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	db.SetMaxOpenConns(cfg.MaxConnections)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(time.Hour)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &PostgresStore{db: db}, nil
}

func (s *PostgresStore) Close() error {
	return s.db.Close()
}

func (s *PostgresStore) Health(ctx context.Context) error {
	return s.db.PingContext(ctx)
}

// DB returns the underlying database connection
func (s *PostgresStore) DB() *sql.DB {
	return s.db
}

// GetAPIKeyByKeyHash retrieves an API key by its hash
func (s *PostgresStore) GetAPIKeyByKeyHash(ctx context.Context, keyHash string) (*domain.APIKey, error) {
	repo := NewAPIKeyRepository(s.db)
	return repo.GetByKeyHash(ctx, keyHash)
}

// UpdateAPIKeyUsage updates the usage statistics for an API key
func (s *PostgresStore) UpdateAPIKeyUsage(ctx context.Context, id uuid.UUID) error {
	repo := NewAPIKeyRepository(s.db)
	return repo.UpdateUsage(ctx, id)
}

// GetTemplateByName retrieves a template by name
func (s *PostgresStore) GetTemplateByName(ctx context.Context, name string) (*domain.Template, error) {
	repo := NewTemplateRepository(s.db)
	return repo.GetByName(ctx, name)
}
