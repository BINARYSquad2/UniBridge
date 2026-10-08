package migrations

import (
	"embed"
	"errors"
	"fmt"
	"log"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/source/iofs"
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

	if err := runner.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("apply migrations: %w", err)
	}
	log.Println("Database migrations applied successfully!")
	return nil
}
