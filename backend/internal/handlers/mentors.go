package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/lib/pq"
)

type Mentors struct {
	DB        *sql.DB
	JWTSecret []byte
}

func (h Mentors) current(w http.ResponseWriter, r *http.Request) (authUser, bool) {
	var u authUser
	rm := Roadmap{JWTSecret: h.JWTSecret}
	id, err := rm.authenticatedUserID(r)
	if err != nil {
		writeAuthError(w, 401, "Сессия истекла. Войдите снова.")
		return u, false
	}
	err = h.DB.QueryRowContext(r.Context(), "SELECT id::text,email,full_name,role::text FROM users WHERE id=$1", id).Scan(&u.ID, &u.Email, &u.FullName, &u.Role)
	if errors.Is(err, sql.ErrNoRows) {
		writeAuthError(w, 401, "Войдите снова")
		return u, false
	}
	if err != nil {
		writeAuthError(w, 500, "Не удалось загрузить пользователя")
		return u, false
	}
	return u, true
}

func jsonResult(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func (h Mentors) Me(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		writeAuthError(w, 405, "method not allowed")
		return
	}
	if u, ok := h.current(w, r); ok {
		jsonResult(w, u)
	}
}

type mentorInfo struct {
	ID       string   `json:"id"`
	FullName string   `json:"full_name"`
	Bio      string   `json:"bio"`
	Subjects []string `json:"subjects"`
	Matches  int      `json:"matches"`
}

func (h Mentors) List(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		writeAuthError(w, 405, "method not allowed")
		return
	}
	u, ok := h.current(w, r)
	if !ok {
		return
	}
	if u.Role != "student" {
		writeAuthError(w, 403, "Раздел доступен ученикам")
		return
	}
	rows, err := h.DB.QueryContext(r.Context(), `
	SELECT u.id::text,u.full_name,COALESCE(p.bio,''),COALESCE(p.subjects,'{}'),
	(SELECT count(*) FROM (SELECT unnest(COALESCE(p.subjects,'{}')) INTERSECT SELECT unnest(s.interests)) common) AS matches
	FROM users u LEFT JOIN mentor_profiles p ON p.user_id=u.id
	LEFT JOIN student_profiles s ON s.user_id=$1
	WHERE u.role='mentor' ORDER BY matches DESC,u.full_name,u.id`, u.ID)
	if err != nil {
		writeAuthError(w, 500, "Не удалось загрузить менторов")
		return
	}
	defer rows.Close()
	result := []mentorInfo{}
	for rows.Next() {
		var m mentorInfo
		if err = rows.Scan(&m.ID, &m.FullName, &m.Bio, pq.Array(&m.Subjects), &m.Matches); err != nil {
			writeAuthError(w, 500, "Не удалось загрузить менторов")
			return
		}
		result = append(result, m)
	}
	if rows.Err() != nil {
		writeAuthError(w, 500, "Не удалось загрузить менторов")
		return
	}
	jsonResult(w, result)
}

type mentorshipRequest struct {
	ID          string    `json:"id"`
	StudentID   string    `json:"student_id"`
	MentorID    string    `json:"mentor_id"`
	StudentName string    `json:"student_name"`
	MentorName  string    `json:"mentor_name"`
	Message     string    `json:"message"`
	Status      string    `json:"status"`
	Grade       int       `json:"school_grade"`
	Interests   []string  `json:"interests"`
	CreatedAt   time.Time `json:"created_at"`
}

func (h Mentors) Requests(w http.ResponseWriter, r *http.Request) {
	u, ok := h.current(w, r)
	if !ok {
		return
	}
	switch r.Method {
	case "GET":
		rows, err := h.DB.QueryContext(r.Context(), `
		SELECT q.id::text,q.student_id::text,q.mentor_id::text,s.full_name,m.full_name,q.message,q.status,
		COALESCE(p.school_grade,0),COALESCE(p.interests,'{}'),q.created_at
		FROM mentorship_requests q JOIN users s ON s.id=q.student_id JOIN users m ON m.id=q.mentor_id
		LEFT JOIN student_profiles p ON p.user_id=s.id
		WHERE ($2='student' AND q.student_id=$1) OR ($2='mentor' AND q.mentor_id=$1)
		ORDER BY q.created_at DESC`, u.ID, u.Role)
		if err != nil {
			writeAuthError(w, 500, "Не удалось загрузить заявки")
			return
		}
		defer rows.Close()
		result := []mentorshipRequest{}
		for rows.Next() {
			var q mentorshipRequest
			if err = rows.Scan(&q.ID, &q.StudentID, &q.MentorID, &q.StudentName, &q.MentorName, &q.Message, &q.Status, &q.Grade, pq.Array(&q.Interests), &q.CreatedAt); err != nil {
				writeAuthError(w, 500, "Не удалось загрузить заявки")
				return
			}
			result = append(result, q)
		}
		if rows.Err() != nil {
			writeAuthError(w, 500, "Не удалось загрузить заявки")
			return
		}
		jsonResult(w, result)
	case "POST":
		if u.Role != "student" {
			writeAuthError(w, 403, "Заявки отправляют только ученики")
			return
		}
		var in struct {
			MentorID string `json:"mentor_id"`
			Message  string `json:"message"`
		}
		if decodeAuthRequest(w, r, &in) != nil {
			writeAuthError(w, 400, "Некорректная заявка")
			return
		}
		in.Message = strings.TrimSpace(in.Message)
		if utf8.RuneCountInString(in.Message) < 1 || utf8.RuneCountInString(in.Message) > 2000 {
			writeAuthError(w, 400, "Описание должно содержать от 1 до 2000 символов")
			return
		}
		var id string
		err := h.DB.QueryRowContext(r.Context(), `INSERT INTO mentorship_requests(student_id,mentor_id,message)
		SELECT $1,id,$3 FROM users WHERE id::text=$2 AND role='mentor' RETURNING id::text`, u.ID, in.MentorID, in.Message).Scan(&id)
		if errors.Is(err, sql.ErrNoRows) {
			writeAuthError(w, 404, "Ментор не найден")
			return
		}
		if err != nil {
			var pe *pq.Error
			if errors.As(err, &pe) && pe.Code == "23505" {
				writeAuthError(w, 409, "У вас уже есть активная заявка этому ментору")
				return
			}
			writeAuthError(w, 500, "Не удалось отправить заявку")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		jsonResult(w, map[string]string{"id": id})
	case "PATCH":
		var in struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		}
		if decodeAuthRequest(w, r, &in) != nil {
			writeAuthError(w, 400, "Некорректный запрос")
			return
		}
		if (u.Role == "mentor" && (in.Status != "accepted" && in.Status != "rejected")) || (u.Role == "student" && in.Status != "cancelled") {
			writeAuthError(w, 403, "Недоступное действие")
			return
		}
		res, err := h.DB.ExecContext(r.Context(), `UPDATE mentorship_requests SET status=$3
		WHERE id::text=$1 AND status='pending' AND (($4='mentor' AND mentor_id=$2) OR ($4='student' AND student_id=$2))`, in.ID, u.ID, in.Status, u.Role)
		if err != nil {
			var pe *pq.Error
			if errors.As(err, &pe) && pe.Code == "23505" {
				writeAuthError(w, 409, "У ученика уже есть принятая заявка")
				return
			}
			writeAuthError(w, 500, "Не удалось обновить заявку")
			return
		}
		n, err := res.RowsAffected()
		if err != nil {
			writeAuthError(w, 500, "Не удалось обновить заявку")
			return
		}
		if n == 0 {
			writeAuthError(w, 409, "Заявка недоступна или уже обработана")
			return
		}
		jsonResult(w, map[string]string{"status": in.Status})
	default:
		writeAuthError(w, 405, "method not allowed")
	}
}
