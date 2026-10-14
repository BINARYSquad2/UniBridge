package migrations

import (
	"embed"
	"errors"
	"fmt"
	"log"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

const (
	interruptedMigrationVersion = 11
	previousMigrationVersion    = 10
)

//go:embed *.sql
var migrationFiles embed.FS

func Apply(databaseURL string) error {
	source, err := iofs.New(migrationFiles, ".")
	if err != nil {
		return fmt.Errorf("load migration files: %w", err)
	}

	runner, err := migrate.NewWithSourceInstance("iofs", source, databaseURL)
	if err != nil {
		return fmt.Errorf("initialize migration runner: %w", err)
	}
	defer func() {
		_, _ = runner.Close()
	}()

	version, dirty, err := runner.Version()
	if err != nil && !errors.Is(err, migrate.ErrNilVersion) {
		return fmt.Errorf("read migration version: %w", err)
	}
	if dirty {
		if version != interruptedMigrationVersion {
			return fmt.Errorf("database migration %d is dirty; manual repair is required", version)
		}
		log.Printf("retrying interrupted migration %d", version)
		if err := runner.Force(previousMigrationVersion); err != nil {
			return fmt.Errorf("prepare interrupted migration retry: %w", err)
		}
	}

	if err := runner.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("apply migrations: %w", err)
	}
	log.Println("Database migrations applied successfully!")
	return nil
}
