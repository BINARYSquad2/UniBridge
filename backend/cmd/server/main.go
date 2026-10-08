package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"unibridge-backend/internal/config"
	"unibridge-backend/internal/server"
	"unibridge-backend/migrations"

	_ "github.com/lib/pq"
)

func main() {
	cfg, err := config.New()
	if err != nil {
		log.Fatalf("configuration failed: %v", err)
	}

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("database is unavailable: %v", err)
	}

	if err := migrations.Apply(cfg.DatabaseURL); err != nil {
		log.Fatalf("database migrations failed: %v", err)
	}

	app := server.New(cfg, db)
	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)

	log.Printf("server started at http://%s", addr)

	if err := app.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server failed: %v", err)
	}
}
