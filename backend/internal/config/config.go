package config

import (
	"errors"
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Host         string
	Port         string
	DatabaseURL  string
	AuthSecret   string
	GeminiAPIKey string
	LLMModel     string
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
		Host:         getEnv("HOST", "0.0.0.0"),
		Port:         getEnv("PORT", "8080"),
		DatabaseURL:  databaseURL,
		AuthSecret:   authSecret,
		GeminiAPIKey: getEnv("GEMINI_API_KEY", ""),
		LLMModel:     getEnv("LLM_MODEL", "gemini-2.5-flash,gemini-2.5-pro"),
	}, nil
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}
	return fallback
}
