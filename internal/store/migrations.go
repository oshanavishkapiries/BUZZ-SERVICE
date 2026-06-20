package store

import (
	"context"
	"embed"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

type Migration struct {
	Version int
	Name    string
	SQL     string
}

func (s *PostgresStore) Migrate(ctx context.Context) error {
	// Create migrations table if not exists
	_, err := s.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INT PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			applied_at TIMESTAMPTZ DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// Fetch the set of already-applied versions.
	// Using a set (not MAX) so that a high-numbered seed migration (e.g. 999)
	// does not block lower-numbered structural migrations added later.
	rows, err := s.db.QueryContext(ctx, "SELECT version FROM schema_migrations")
	if err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}
	applied := make(map[int]bool)
	for rows.Next() {
		var v int
		if err := rows.Scan(&v); err != nil {
			rows.Close()
			return fmt.Errorf("failed to scan migration version: %w", err)
		}
		applied[v] = true
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return fmt.Errorf("failed to read applied migrations: %w", err)
	}

	// Load migrations
	migrations, err := loadMigrations()
	if err != nil {
		return err
	}

	// Apply every migration that has not yet been recorded, in version order.
	for _, m := range migrations {
		if applied[m.Version] {
			continue
		}

		if err := s.applyMigration(ctx, m); err != nil {
			return fmt.Errorf("failed to apply migration %d: %w", m.Version, err)
		}

		fmt.Printf("Applied migration %d: %s\n", m.Version, m.Name)
	}

	return nil
}

func loadMigrations() ([]Migration, error) {
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return nil, err
	}

	var migrations []Migration
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}

		// Parse filename: 000_init.sql -> version=0, name=init
		parts := strings.SplitN(entry.Name(), "_", 2)
		if len(parts) != 2 {
			continue
		}

		version, err := strconv.Atoi(parts[0])
		if err != nil {
			continue
		}

		name := strings.TrimSuffix(parts[1], ".sql")

		content, err := migrationsFS.ReadFile("migrations/" + entry.Name())
		if err != nil {
			return nil, err
		}

		migrations = append(migrations, Migration{
			Version: version,
			Name:    name,
			SQL:     string(content),
		})
	}

	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})

	return migrations, nil
}

func (s *PostgresStore) applyMigration(ctx context.Context, m Migration) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Execute migration SQL
	if _, err := tx.ExecContext(ctx, m.SQL); err != nil {
		return err
	}

	// Record migration
	_, err = tx.ExecContext(ctx,
		"INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
		m.Version, m.Name,
	)
	if err != nil {
		return err
	}

	return tx.Commit()
}
