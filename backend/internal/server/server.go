package server

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"unibridge-backend/internal/config"
	"unibridge-backend/internal/handlers"
)

func New(cfg config.Config, db *sql.DB) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handlers.Healthz)
	mux.HandleFunc("/api/v1/status", handlers.Status)
	auth := handlers.Auth{DB: db, JWTSecret: []byte(cfg.AuthSecret)}
	mux.HandleFunc("/api/v1/auth/register", auth.Register)
	mux.HandleFunc("/api/v1/auth/login", auth.Login)
	mentors := handlers.Mentors{
	DB:        db,
	JWTSecret: []byte(cfg.AuthSecret),
}
mux.HandleFunc("/api/v1/mentors", mentors.List)
	roadmap := handlers.Roadmap{
		DB:        db,
		JWTSecret: []byte(cfg.AuthSecret),
		APIKey:    cfg.LLMAPIKey,
		BaseURL:   cfg.LLMBaseURL,
		Model:     cfg.LLMModel,
	}
	mux.HandleFunc("/api/v1/roadmap/generate", roadmap.Generate)

	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)

	return &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      65 * time.Second,
		IdleTimeout:       30 * time.Second,
	}
}
