package migrations

import (
	"database/sql"
	"os"
	"testing"

	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "github.com/lib/pq"
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

	if expected != 4 {
		t.Fatalf("total migration count = %d, want 4", expected)
	}
}

func TestApplyFromEmptyDatabase(t *testing.T) {
	databaseURL := os.Getenv("UNIBRIDGE_MIGRATION_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set UNIBRIDGE_MIGRATION_TEST_DATABASE_URL to an empty disposable database")
	}

	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		t.Fatalf("open migration test database: %v", err)
	}
	var tableCount int
	err = db.QueryRow(`
		SELECT count(*)
		FROM information_schema.tables
		WHERE table_schema = 'public'
	`).Scan(&tableCount)
	if closeErr := db.Close(); closeErr != nil {
		t.Fatalf("close migration test database: %v", closeErr)
	}
	if err != nil {
		t.Fatalf("check migration test database is empty: %v", err)
	}
	if tableCount != 0 {
		t.Fatalf("migration test database is not empty: found %d public tables", tableCount)
	}

	if err := Apply(databaseURL); err != nil {
		t.Fatalf("apply migrations to empty database: %v", err)
	}

	db, err = sql.Open("postgres", databaseURL)
	if err != nil {
		t.Fatalf("reopen migrated database: %v", err)
	}
	defer db.Close()

	var version uint
	var dirty bool
	if err := db.QueryRow(`SELECT version, dirty FROM schema_migrations`).Scan(&version, &dirty); err != nil {
		t.Fatalf("read applied migration version: %v", err)
	}
	if version != 4 || dirty {
		t.Fatalf("migration state = (%d, dirty=%t), want (4, dirty=false)", version, dirty)
	}

	var schemaReady bool
	err = db.QueryRow(`
		SELECT to_regclass('public.users') IS NOT NULL
		   AND to_regclass('public.student_profiles') IS NOT NULL
		   AND to_regclass('public.roadmap_plans') IS NOT NULL
		   AND to_regclass('public.kanban_tasks') IS NOT NULL
		   AND (
		       SELECT count(*) = 3
		       FROM information_schema.columns
		       WHERE table_schema = 'public'
		         AND column_name = 'track'
		         AND table_name IN ('roadmap_steps', 'roadmap_tasks', 'kanban_tasks')
		   )
		   AND (
		       SELECT count(*) = 5
		       FROM information_schema.columns
		       WHERE table_schema = 'public'
		         AND table_name = 'student_profiles'
		         AND column_name IN (
		             'target_universities', 'weekly_hours', 'exams',
		             'academic_background', 'gpa'
		         )
		   )
	`).Scan(&schemaReady)
	if err != nil {
		t.Fatalf("check migrated schema: %v", err)
	}
	if !schemaReady {
		t.Fatal("expected core tables and student profile columns are missing")
	}
}
