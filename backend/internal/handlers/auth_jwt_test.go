package handlers

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestAuthenticatedUserID(t *testing.T) {
	secret := []byte(strings.Repeat("s", 32))
	now := time.Now()
	validClaims := jwt.RegisteredClaims{
		Subject:   "user-123",
		IssuedAt:  jwt.NewNumericDate(now.Add(-time.Minute)),
		ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
	}

	tests := []struct {
		name       string
		method     *jwt.SigningMethodHMAC
		claims     jwt.RegisteredClaims
		header     string
		wantUserID string
		wantError  bool
	}{
		{
			name:       "valid bearer token",
			method:     jwt.SigningMethodHS256,
			claims:     validClaims,
			header:     "Bearer",
			wantUserID: "user-123",
		},
		{
			name:      "reject HS384",
			method:    jwt.SigningMethodHS384,
			claims:    validClaims,
			header:    "Bearer",
			wantError: true,
		},
		{
			name:   "require subject",
			method: jwt.SigningMethodHS256,
			claims: jwt.RegisteredClaims{
				IssuedAt:  validClaims.IssuedAt,
				ExpiresAt: validClaims.ExpiresAt,
			},
			header:    "Bearer",
			wantError: true,
		},
		{
			name:   "require issued-at",
			method: jwt.SigningMethodHS256,
			claims: jwt.RegisteredClaims{
				Subject:   validClaims.Subject,
				ExpiresAt: validClaims.ExpiresAt,
			},
			header:    "Bearer",
			wantError: true,
		},
		{
			name:   "require expiration",
			method: jwt.SigningMethodHS256,
			claims: jwt.RegisteredClaims{
				Subject:  validClaims.Subject,
				IssuedAt: validClaims.IssuedAt,
			},
			header:    "Bearer",
			wantError: true,
		},
		{
			name:   "reject expired token",
			method: jwt.SigningMethodHS256,
			claims: jwt.RegisteredClaims{
				Subject:   validClaims.Subject,
				IssuedAt:  validClaims.IssuedAt,
				ExpiresAt: jwt.NewNumericDate(now.Add(-time.Minute)),
			},
			header:    "Bearer",
			wantError: true,
		},
		{
			name:   "reject future issued-at",
			method: jwt.SigningMethodHS256,
			claims: jwt.RegisteredClaims{
				Subject:   validClaims.Subject,
				IssuedAt:  jwt.NewNumericDate(now.Add(time.Minute)),
				ExpiresAt: validClaims.ExpiresAt,
			},
			header:    "Bearer",
			wantError: true,
		},
		{
			name:      "reject missing bearer scheme",
			method:    jwt.SigningMethodHS256,
			claims:    validClaims,
			header:    "Basic",
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, err := jwt.NewWithClaims(tt.method, tt.claims).SignedString(secret)
			if err != nil {
				t.Fatalf("sign test token: %v", err)
			}

			request := httptest.NewRequest("GET", "/", nil)
			if tt.header != "" {
				request.Header.Set("Authorization", tt.header+" "+token)
			}

			userID, err := authenticatedUserID(request, secret)
			if tt.wantError {
				if err == nil {
					t.Fatal("expected authentication error")
				}
				return
			}
			if err != nil {
				t.Fatalf("authenticatedUserID() error = %v", err)
			}
			if userID != tt.wantUserID {
				t.Errorf("authenticatedUserID() = %q, want %q", userID, tt.wantUserID)
			}
		})
	}
}

func TestAuthenticatedUserIDRejectsInvalidSignature(t *testing.T) {
	secret := []byte(strings.Repeat("s", 32))
	otherSecret := []byte(strings.Repeat("x", 32))
	now := time.Now()
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Subject:   "user-123",
		IssuedAt:  jwt.NewNumericDate(now.Add(-time.Minute)),
		ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
	}).SignedString(otherSecret)
	if err != nil {
		t.Fatalf("sign test token: %v", err)
	}

	request := httptest.NewRequest("GET", "/", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	if _, err := authenticatedUserID(request, secret); err == nil {
		t.Fatal("expected invalid signature to be rejected")
	}
}

func TestAuthenticatedUserIDRejectsShortSecret(t *testing.T) {
	request := httptest.NewRequest("GET", "/", nil)
	request.Header.Set("Authorization", "Bearer token")
	if _, err := authenticatedUserID(request, []byte("short")); err == nil {
		t.Fatal("expected short signing key to be rejected")
	}
}
