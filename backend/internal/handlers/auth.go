package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

type Auth struct {
	DB        *sql.DB
	JWTSecret []byte
}

type authUser struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	FullName    string `json:"full_name"`
	Role        string `json:"role"`
	SchoolGrade *int   `json:"school_grade,omitempty"`
}

type authResponse struct {
	AccessToken string   `json:"access_token"`
	User        authUser `json:"user"`
}

type registerRequest struct {
 Bio string `json:"bio"`
 Subjects []string `json:"subjects"`
	FullName       string   `json:"full_name"`
	Email          string   `json:"email"`
	Password       string   `json:"password"`
	Role           string   `json:"role"`
	SchoolGrade    *int     `json:"school_grade"`
	Interests      []string `json:"interests"`
	Strengths      []string `json:"strengths"`
	Weaknesses     []string `json:"weaknesses"`
	PortfolioStage string   `json:"portfolio_stage"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (a Auth) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeAuthError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var input registerRequest
	if err := decodeAuthRequest(w, r, &input); err != nil {
		writeAuthError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	input.FullName = strings.TrimSpace(input.FullName)
	input.Email = normalizeEmail(input.Email)
	if input.Role == "" {
		input.Role = "student"
	}
	if input.FullName == "" || len(input.FullName) > 255 || !validEmail(input.Email) ||
		len(input.Password) < 8 || len(input.Password) > 72 ||
		(input.Role != "student" && input.Role != "mentor") {
		writeAuthError(w, http.StatusBadRequest, "invalid registration details")
		return
	}
	if input.Role == "student" && (input.SchoolGrade == nil || *input.SchoolGrade < 7 || *input.SchoolGrade > 11) {
		writeAuthError(w, http.StatusBadRequest, "school_grade must be between 7 and 11")
		return
	}
	if input.Role == "student" && !validPortfolioStage(input.PortfolioStage) {
		writeAuthError(w, http.StatusBadRequest, "invalid portfolio_stage")
		return
	}

 if input.Role == "mentor" && (len(strings.TrimSpace(input.Bio)) == 0 || len(input.Bio) > 4000 || len(input.Subjects) == 0 || len(input.Subjects) > 14) {
 writeAuthError(w, http.StatusBadRequest, "Укажите описание и направления ментора")
 return
 }
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		writeAuthError(w, http.StatusInternalServerError, "could not create account")
		return
	}

	tx, err := a.DB.BeginTx(r.Context(), nil)
	if err != nil {
		log.Printf("register: begin transaction: %v", err)
		writeAuthError(w, http.StatusInternalServerError, "could not create account")
		return
	}
	defer tx.Rollback()

	var user authUser
	err = tx.QueryRowContext(r.Context(), `
		INSERT INTO users (email, password_hash, full_name, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id::text, email, full_name, role::text
	`, input.Email, string(passwordHash), input.FullName, input.Role).Scan(
		&user.ID, &user.Email, &user.FullName, &user.Role,
	)
	if err != nil {
		var postgresError *pq.Error
		if errors.As(err, &postgresError) && postgresError.Code == "23505" {
			writeAuthError(w, http.StatusConflict, "email is already registered")
			return
		}
		log.Printf("register: insert user: %v", err)
		writeAuthError(w, http.StatusInternalServerError, "could not create account")
		return
	}
	if input.Role == "student" {
		_, err = tx.ExecContext(r.Context(), `
			INSERT INTO student_profiles (
				user_id, school_grade, interests, strengths, weaknesses, portfolio_stage
			) VALUES ($1, $2, $3, $4, $5, $6)
		`, user.ID, *input.SchoolGrade, pq.Array(input.Interests), pq.Array(input.Strengths),
			pq.Array(input.Weaknesses), input.PortfolioStage)
		if err != nil {
			log.Printf("register: insert student profile: %v", err)
			writeAuthError(w, http.StatusInternalServerError, "could not create student profile")
			return
		}
		user.SchoolGrade = input.SchoolGrade
	}
 if input.Role == "mentor" {
 _, err = tx.ExecContext(r.Context(), `INSERT INTO mentor_profiles (user_id, bio, subjects) VALUES ($1,$2,$3)`, user.ID, strings.TrimSpace(input.Bio), pq.Array(input.Subjects))
 if err != nil { writeAuthError(w, 500, "Не удалось создать профиль ментора"); return }
 }
	if err := tx.Commit(); err != nil {
		log.Printf("register: commit transaction: %v", err)
		writeAuthError(w, http.StatusInternalServerError, "could not create account")
		return
	}

	a.writeAuthResponse(w, http.StatusCreated, user)
}

func validPortfolioStage(stage string) bool {
	switch stage {
	case "starting", "in_progress", "achieving", "completed":
		return true
	default:
		return false
	}
}

func (a Auth) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeAuthError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var input loginRequest
	if err := decodeAuthRequest(w, r, &input); err != nil {
		writeAuthError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	input.Email = normalizeEmail(input.Email)
	if !validEmail(input.Email) || input.Password == "" || len(input.Password) > 72 {
		writeAuthError(w, http.StatusBadRequest, "invalid login details")
		return
	}

	var user authUser
	var passwordHash string
	var schoolGrade sql.NullInt64
	err := a.DB.QueryRowContext(r.Context(), `
		SELECT u.id::text, u.email, u.full_name, u.role::text, u.password_hash, sp.school_grade
		FROM users u
	LEFT JOIN student_profiles sp ON sp.user_id = u.id
		WHERE u.email = $1
	`, input.Email).Scan(
		&user.ID, &user.Email, &user.FullName, &user.Role, &passwordHash, &schoolGrade,
	)
	if errors.Is(err, sql.ErrNoRows) {
		writeAuthError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if err != nil {
		writeAuthError(w, http.StatusInternalServerError, "could not sign in")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(input.Password)) != nil {
		writeAuthError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if schoolGrade.Valid {
		grade := int(schoolGrade.Int64)
		user.SchoolGrade = &grade
	}

	a.writeAuthResponse(w, http.StatusOK, user)
}

func (a Auth) writeAuthResponse(w http.ResponseWriter, status int, user authUser) {
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Subject:   user.ID,
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
	}).SignedString(a.JWTSecret)
	if err != nil {
		writeAuthError(w, http.StatusInternalServerError, "could not create access token")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(authResponse{AccessToken: token, User: user})
}

func decodeAuthRequest(w http.ResponseWriter, r *http.Request, destination any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return err
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return errors.New("request must contain a single JSON object")
	}
	return nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func validEmail(email string) bool {
	address, err := mail.ParseAddress(email)
	return err == nil && address.Address == email && len(email) <= 255
}

func writeAuthError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}
