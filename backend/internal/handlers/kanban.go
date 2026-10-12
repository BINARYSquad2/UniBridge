package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
)

type Kanban struct {
	DB        *sql.DB
	JWTSecret []byte
}

type kanbanMicroStep struct {
	ID               string `json:"id"`
	Title            string `json:"title"`
	EstimatedMinutes *int   `json:"estimated_minutes,omitempty"`
	Completed        bool   `json:"completed"`
	ActualMinutes    *int   `json:"actual_minutes,omitempty"`
}

type kanbanTask struct {
	ID         string            `json:"id"`
	Title      string            `json:"title"`
	Duration   string            `json:"duration"`
	TaskType   string            `json:"task_type"`
	Status     string            `json:"status"`
	MicroSteps []kanbanMicroStep `json:"micro_steps"`
}

type createKanbanTaskRequest struct {
	Title      string            `json:"title"`
	Duration   string            `json:"duration"`
	TaskType   string            `json:"task_type"`
	MicroSteps []kanbanMicroStep `json:"micro_steps"`
}

type updateKanbanTaskRequest struct {
	Status     string             `json:"status"`
	MicroSteps *[]kanbanMicroStep `json:"micro_steps"`
}

func (h Kanban) ListTasks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeAuthError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	userID, err := authenticatedUserID(r, h.JWTSecret)
	if err != nil {
		writeAuthError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	rows, err := h.DB.QueryContext(r.Context(), `
		SELECT id::text, title, duration, task_type, status, micro_steps::text
		FROM kanban_tasks
		WHERE user_id = $1
		ORDER BY created_at DESC, id
	`, userID)
	if err != nil {
		writeKanbanError(w, "list tasks", err)
		return
	}
	defer rows.Close()

	tasks := make([]kanbanTask, 0)
	for rows.Next() {
		var task kanbanTask
		var microStepsJSON string
		if err := rows.Scan(&task.ID, &task.Title, &task.Duration, &task.TaskType, &task.Status, &microStepsJSON); err != nil {
			writeKanbanError(w, "scan task", err)
			return
		}
		if err := json.Unmarshal([]byte(microStepsJSON), &task.MicroSteps); err != nil {
			writeKanbanError(w, "decode task micro-steps", err)
			return
		}
		if task.MicroSteps == nil {
			task.MicroSteps = []kanbanMicroStep{}
		}
		tasks = append(tasks, task)
	}
	if err := rows.Err(); err != nil {
		writeKanbanError(w, "iterate tasks", err)
		return
	}

	writeKanbanJSON(w, http.StatusOK, tasks)
}

func (h Kanban) ImportRoadmapStep(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeAuthError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	userID, err := authenticatedUserID(r, h.JWTSecret)
	if err != nil {
		writeAuthError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	tx, err := h.DB.BeginTx(r.Context(), nil)
	if err != nil {
		writeKanbanError(w, "begin roadmap task import", err)
		return
	}
	defer tx.Rollback()

	stepID := r.PathValue("stepID")
	var roadmapStepDBID string
	err = tx.QueryRowContext(r.Context(), `
		SELECT step.id::text
			FROM roadmap_steps AS step
			JOIN roadmap_plans AS plan ON plan.id = step.roadmap_plan_id
			JOIN student_profiles AS profile ON profile.id = plan.student_profile_id
			WHERE (step.id::text = $1 OR step.source_id = $1)
				AND plan.is_active AND profile.user_id = $2
		LIMIT 1
	`, stepID, userID).Scan(&roadmapStepDBID)
	if errors.Is(err, sql.ErrNoRows) {
		writeAuthError(w, http.StatusNotFound, "roadmap step not found")
		return
	}
	if err != nil {
		writeKanbanError(w, "check roadmap step ownership", err)
		return
	}

	rows, err := tx.QueryContext(r.Context(), `
		SELECT task.id::text, task.title, task.duration, COALESCE(task.task_type, 'other'), task.completed,
			COALESCE(jsonb_agg(jsonb_build_object(
				'id', micro.id::text,
				'title', micro.title,
				'estimated_minutes', micro.estimated_minutes,
				'completed', micro.completed,
				'actual_minutes', micro.actual_minutes
			) ORDER BY micro.position) FILTER (WHERE micro.id IS NOT NULL), '[]'::jsonb)::text
		FROM roadmap_tasks AS task
		LEFT JOIN roadmap_micro_steps AS micro ON micro.roadmap_task_id = task.id
		WHERE task.roadmap_step_id = $1
		GROUP BY task.id
		ORDER BY task.position
	`, roadmapStepDBID)
	if err != nil {
		writeKanbanError(w, "load roadmap tasks", err)
		return
	}
	defer rows.Close()

	importedTasks := make([]kanbanTask, 0)
	for rows.Next() {
		var sourceID, title, duration, taskType, microStepsJSON string
		var completed bool
		if err := rows.Scan(&sourceID, &title, &duration, &taskType, &completed, &microStepsJSON); err != nil {
			writeKanbanError(w, "scan roadmap task", err)
			return
		}
		var microSteps []kanbanMicroStep
		if err := json.Unmarshal([]byte(microStepsJSON), &microSteps); err != nil {
			writeKanbanError(w, "decode roadmap task micro-steps", err)
			return
		}
		if microSteps == nil {
			microSteps = []kanbanMicroStep{}
		}
		status := "todo"
		if completed {
			status = "done"
		} else {
			for _, microStep := range microSteps {
				if microStep.Completed {
					status = "in_progress"
					break
				}
			}
		}
		importedTasks = append(importedTasks, kanbanTask{
			ID: sourceID, Title: title, Duration: duration, TaskType: taskType,
			Status: status, MicroSteps: microSteps,
		})
	}
	if err := rows.Err(); err != nil {
		writeKanbanError(w, "iterate roadmap tasks", err)
		return
	}
	if err := rows.Close(); err != nil {
		writeKanbanError(w, "close roadmap tasks", err)
		return
	}

	added := 0
	for _, task := range importedTasks {
		encodedMicroSteps, err := json.Marshal(task.MicroSteps)
		if err != nil {
			writeKanbanError(w, "encode roadmap task micro-steps", err)
			return
		}
		result, err := tx.ExecContext(r.Context(), `
			INSERT INTO kanban_tasks (user_id, source_roadmap_task_id, title, duration, task_type, status, micro_steps)
			VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
			ON CONFLICT (user_id, source_roadmap_task_id) DO NOTHING
		`, userID, task.ID, task.Title, task.Duration, task.TaskType, task.Status, string(encodedMicroSteps))
		if err != nil {
			writeKanbanError(w, "save imported task", err)
			return
		}
		count, err := result.RowsAffected()
		if err != nil {
			writeKanbanError(w, "count imported tasks", err)
			return
		}
		added += int(count)
	}
	if err := tx.Commit(); err != nil {
		writeKanbanError(w, "commit roadmap task import", err)
		return
	}

	writeKanbanJSON(w, http.StatusOK, map[string]int{"added": added})
}

func (h Kanban) CreateTask(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeAuthError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	userID, err := authenticatedUserID(r, h.JWTSecret)
	if err != nil {
		writeAuthError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var input createKanbanTaskRequest
	if err := decodeAuthRequest(w, r, &input); err != nil {
		writeAuthError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	input.Title = strings.TrimSpace(input.Title)
	input.Duration = strings.TrimSpace(input.Duration)
	input.TaskType = strings.TrimSpace(input.TaskType)
	if input.Duration == "" {
		input.Duration = "1 час"
	}
	if input.TaskType == "" {
		input.TaskType = "other"
	}
	if input.Title == "" || len(input.Title) > 500 || len(input.Duration) > 120 || len(input.TaskType) > 100 || len(input.MicroSteps) > 100 {
		writeAuthError(w, http.StatusBadRequest, "task fields are invalid")
		return
	}
	if err := validateKanbanMicroSteps(input.MicroSteps); err != nil {
		writeAuthError(w, http.StatusBadRequest, err.Error())
		return
	}
	microStepsJSON, err := json.Marshal(input.MicroSteps)
	if err != nil {
		writeKanbanError(w, "encode task micro-steps", err)
		return
	}
	var task kanbanTask
	var encodedMicroSteps string
	err = h.DB.QueryRowContext(r.Context(), `
		INSERT INTO kanban_tasks (user_id, title, duration, task_type, micro_steps)
		VALUES ($1, $2, $3, $4, $5::jsonb)
		RETURNING id::text, title, duration, task_type, status, micro_steps::text
	`, userID, input.Title, input.Duration, input.TaskType, string(microStepsJSON)).Scan(
		&task.ID, &task.Title, &task.Duration, &task.TaskType, &task.Status, &encodedMicroSteps,
	)
	if err != nil {
		writeKanbanError(w, "create task", err)
		return
	}
	if err := json.Unmarshal([]byte(encodedMicroSteps), &task.MicroSteps); err != nil {
		writeKanbanError(w, "decode created task micro-steps", err)
		return
	}
	writeKanbanJSON(w, http.StatusCreated, task)
}

func (h Kanban) UpdateTask(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		writeAuthError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	userID, err := authenticatedUserID(r, h.JWTSecret)
	if err != nil {
		writeAuthError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var input updateKanbanTaskRequest
	if err := decodeAuthRequest(w, r, &input); err != nil {
		writeAuthError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if input.Status != "todo" && input.Status != "in_progress" && input.Status != "done" {
		writeAuthError(w, http.StatusBadRequest, "invalid task status")
		return
	}
	if input.MicroSteps == nil || len(*input.MicroSteps) > 100 {
		writeAuthError(w, http.StatusBadRequest, "micro_steps are required and must contain at most 100 items")
		return
	}
	if err := validateKanbanMicroSteps(*input.MicroSteps); err != nil {
		writeAuthError(w, http.StatusBadRequest, err.Error())
		return
	}
	microStepsJSON, err := json.Marshal(*input.MicroSteps)
	if err != nil {
		writeKanbanError(w, "encode task micro-steps", err)
		return
	}
	var task kanbanTask
	var encodedMicroSteps string
	err = h.DB.QueryRowContext(r.Context(), `
		UPDATE kanban_tasks
		SET status = $1, micro_steps = $2::jsonb, updated_at = CURRENT_TIMESTAMP
		WHERE id = $3 AND user_id = $4
		RETURNING id::text, title, duration, task_type, status, micro_steps::text
	`, input.Status, string(microStepsJSON), r.PathValue("taskID"), userID).Scan(
		&task.ID, &task.Title, &task.Duration, &task.TaskType, &task.Status, &encodedMicroSteps,
	)
	if errors.Is(err, sql.ErrNoRows) {
		writeAuthError(w, http.StatusNotFound, "kanban task not found")
		return
	}
	if err != nil {
		writeKanbanError(w, "update task", err)
		return
	}
	if err := json.Unmarshal([]byte(encodedMicroSteps), &task.MicroSteps); err != nil {
		writeKanbanError(w, "decode updated task micro-steps", err)
		return
	}
	writeKanbanJSON(w, http.StatusOK, task)
}

func validateKanbanMicroSteps(microSteps []kanbanMicroStep) error {
	for _, microStep := range microSteps {
		if strings.TrimSpace(microStep.ID) == "" || strings.TrimSpace(microStep.Title) == "" || len(microStep.Title) > 500 {
			return errors.New("each micro-step requires an id and a title of at most 500 characters")
		}
		if microStep.EstimatedMinutes != nil && *microStep.EstimatedMinutes < 1 {
			return errors.New("estimated_minutes must be positive")
		}
		if microStep.ActualMinutes != nil && *microStep.ActualMinutes < 0 {
			return errors.New("actual_minutes cannot be negative")
		}
	}
	return nil
}

func writeKanbanJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeKanbanError(w http.ResponseWriter, operation string, err error) {
	log.Printf("kanban: %s: %v", operation, err)
	writeAuthError(w, http.StatusInternalServerError, "could not "+operation)
}
