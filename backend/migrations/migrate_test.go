package migrations

import (
	"os"
	"testing"

	"github.com/golang-migrate/migrate/v4/source/iofs"
)

func TestMigrationFilesContainNoConflictMarkers(t *testing.T) {
	entries, err := migrationFiles.ReadDir(".")
	if err != nil {
		t.Fatalf("read migration files: %v", err)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		contents, err := migrationFiles.ReadFile(entry.Name())
		if err != nil {
			t.Fatalf("read migration %s: %v", entry.Name(), err)
		}
		for _, marker := range []string{"<<<<<<<", "=======", ">>>>>>>"} {
			if containsLine(contents, marker) {
				t.Fatalf("migration %s contains Git conflict marker %q", entry.Name(), marker)
			}
		}
	}
}

func containsLine(contents []byte, marker string) bool {
	for _, line := range splitLines(string(contents)) {
		if len(line) >= len(marker) {
			for i := 0; i <= len(line)-len(marker); i++ {
				if line[i:i+len(marker)] == marker {
					return true
				}
			}
		}
	}
	return false
}

func splitLines(contents string) []string {
	lines := []string{}
	start := 0
	for i, char := range contents {
		if char == '\n' {
			lines = append(lines, contents[start:i])
			start = i + 1
		}
	}
	if start < len(contents) {
		lines = append(lines, contents[start:])
	}
	return lines
}

func TestApplyOnEmptyPostgres(t *testing.T) {
	databaseURL := os.Getenv("MIGRATION_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("MIGRATION_TEST_DATABASE_URL is not set")
	}
	if err := Apply(databaseURL); err != nil {
		t.Fatalf("apply migrations to empty PostgreSQL: %v", err)
	}
}

func TestEmbeddedMigrationVersionsAreContiguous(t *testing.T) {
	source, err := iofs.New(migrationFiles, ".")
	if err != nil {
		t.Fatalf("load migration source: %v", err)
	}

	version, err := source.First()
	if err != nil {
		t.Fatalf("get first migration version: %v", err)
	}

	expected := uint(1)
	for {
		if version != expected {
			t.Fatalf("migration version = %d, want %d", version, expected)
		}

		nextVersion, err := source.Next(version)
		if err != nil {
			if os.IsNotExist(err) {
				break
			}
			t.Fatalf("get migration after version %d: %v", expected, err)
		}

		version = nextVersion
		expected++
	}

	if expected != 3 {
		t.Fatalf("total migration count = %d, want 3", expected)
	}
}
