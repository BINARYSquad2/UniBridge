package migrations

import (
	"testing"

	"github.com/golang-migrate/migrate/v4/source/iofs"
)

func TestEmbeddedMigrationVersionsAreContiguous(t *testing.T) {
	source, err := iofs.New(migrationFiles, ".")
	if err != nil {
		t.Fatalf("load migration source: %v", err)
	}

	version, err := source.First()
	if err != nil {
		t.Fatalf("get first migration version: %v", err)
	}

	for expected := uint(1); expected <= 14; expected++ {
		if version != expected {
			t.Fatalf("migration version = %d, want %d", version, expected)
		}
		if expected < 14 {
			version, err = source.Next(version)
			if err != nil {
				t.Fatalf("get migration after version %d: %v", expected, err)
			}
		}
	}

	if _, err := source.Next(version); err == nil {
		t.Fatalf("found an unexpected migration after version %d", version)
	}
}
