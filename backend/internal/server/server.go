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

	auth := handlers.Auth{
		DB:        db,
		JWTSecret: []byte(cfg.AuthSecret),
	}

	mux.HandleFunc("/api/v1/auth/register", auth.Register)
	mux.HandleFunc("/api/v1/auth/login", auth.Login)
	mux.HandleFunc("/api/v1/profile/me", auth.CurrentProfile)
	mentors := handlers.Mentors{
		DB:        db,
		JWTSecret: []byte(cfg.AuthSecret),
	}
	mux.HandleFunc("/api/v1/mentors", mentors.List)
	mux.HandleFunc("/api/v1/auth/me", auth.CurrentProfile)
	mux.HandleFunc("/api/v1/mentorship/requests", mentors.Requests)
	roadmap := handlers.Roadmap{
		DB:        db,
		JWTSecret: []byte(cfg.AuthSecret),
		APIKey:    cfg.GeminiAPIKey,
		Model:     cfg.LLMModel,
	}

	kanban := handlers.Kanban{
		DB:        db,
		JWTSecret: []byte(cfg.AuthSecret),
	}

	mux.HandleFunc("GET /api/v1/kanban/tasks", kanban.ListTasks)
	mux.HandleFunc("POST /api/v1/kanban/tasks", kanban.CreateTask)
	mux.HandleFunc("PATCH /api/v1/kanban/tasks/{taskID}", kanban.UpdateTask)
	mux.HandleFunc("POST /api/v1/kanban/roadmap-steps/{stepID}/import", kanban.ImportRoadmapStep)

	mux.HandleFunc("POST /api/v1/roadmap/generate", roadmap.Generate)
	mux.HandleFunc("GET /api/v1/roadmap/current", roadmap.Current)
	mux.HandleFunc("PATCH /api/v1/roadmap/tasks/{taskID}", roadmap.UpdateTask)
	mux.HandleFunc("POST /api/v1/roadmap/tasks/{taskID}/micro-steps", roadmap.CreateMicroStep)
	mux.HandleFunc("PATCH /api/v1/roadmap/micro-steps/{microStepID}", roadmap.UpdateMicroStep)
	mux.HandleFunc("GET /api/v1/roadmap/metrics", roadmap.Metrics)

	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)

	return &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      190 * time.Second,
		IdleTimeout:       30 * time.Second,
	}
}
