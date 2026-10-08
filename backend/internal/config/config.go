package config

import (
	"errors"
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Host        string
	Port        string
	DatabaseURL string
	AuthSecret  string
	LLMAPIKey   string
	LLMBaseURL  string
	LLMModel    string
}

func New() (Config, error) {
	if err := godotenv.Load(); err != nil && !errors.Is(err, os.ErrNotExist) {
		return Config{}, fmt.Errorf("load .env: %w", err)
	}

	databaseURL := getEnv("DATABASE_URL", "")
	if databaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}

	authSecret := getEnv("AUTH_SECRET", "")
	if len(authSecret) < 32 {
		return Config{}, errors.New("AUTH_SECRET must be at least 32 characters")
	}

	return Config{
		Host:        getEnv("HOST", "0.0.0.0"),
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: databaseURL,
		AuthSecret:  authSecret,
		LLMAPIKey:   getEnv("LLM_API_KEY", ""),
		LLMBaseURL:  getEnv("LLM_BASE_URL", "https://api.openai.com/v1"),
		LLMModel:    getEnv("LLM_MODEL", "gpt-4o-mini"),
	}, nil
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}
	return fallback
}
