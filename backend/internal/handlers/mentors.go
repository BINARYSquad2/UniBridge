package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
)

type Mentors struct {
	DB        *sql.DB
	JWTSecret []byte
}

type mentorInfo struct {
	ID       string `json:"id"`
	FullName string `json:"full_name"`
	Bio      string `json:"bio"`
}

func (h Mentors) List(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", "GET")
		writeAuthError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	// Используем проверку JWT, которая уже есть в roadmap.go.
	_, err := (Roadmap{JWTSecret: h.JWTSecret}).authenticatedUserID(r)
	if err != nil {
		writeAuthError(w, http.StatusUnauthorized, "please sign in")
		return
	}

	rows, err := h.DB.QueryContext(r.Context(), `
		SELECT u.id::text, u.full_name, COALESCE(p.bio, '')
		FROM users u
		LEFT JOIN mentor_profiles p ON p.user_id = u.id
		WHERE u.role = 'mentor'
		ORDER BY u.full_name, u.id
	`)
	if err != nil {
		log.Printf("list mentors: %v", err)
		writeAuthError(w, http.StatusInternalServerError, "could not load mentors")
		return
	}
	defer rows.Close()

	mentors := []mentorInfo{}

	for rows.Next() {
		var mentor mentorInfo

		if err := rows.Scan(
			&mentor.ID,
			&mentor.FullName,
			&mentor.Bio,
		); err != nil {
			log.Printf("scan mentor: %v", err)
			writeAuthError(w, http.StatusInternalServerError, "could not load mentors")
			return
		}

		mentors = append(mentors, mentor)
	}

	if err := rows.Err(); err != nil {
		log.Printf("read mentors: %v", err)
		writeAuthError(w, http.StatusInternalServerError, "could not load mentors")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(mentors)
}