package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
)

type createMicroStepRequest struct {
	Title string `json:"title"`
}

func (h Roadmap) CreateMicroStep(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeAuthError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	userID, err := authenticatedUserID(r, h.JWTSecret)
	if err != nil {
		writeAuthError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var input createMicroStepRequest
	if err := decodeAuthRequest(w, r, &input); err != nil {
		writeAuthError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	input.Title = strings.TrimSpace(input.Title)
	if input.Title == "" || len(input.Title) > 500 {
		writeAuthError(w, http.StatusBadRequest, "title is required and must be at most 500 characters")
		return
	}

	tx, err := h.DB.BeginTx(r.Context(), nil)
	if err != nil {
		writeTrackingError(w, "begin micro-step creation", err)
		return
	}
	defer tx.Rollback()
	taskID := r.PathValue("taskID")
	var planID string
	var taskCompleted bool
	err = tx.QueryRowContext(r.Context(), `
		SELECT plan.id::text, task.completed
		FROM roadmap_tasks AS task
		JOIN roadmap_steps AS step ON step.id = task.roadmap_step_id
		JOIN roadmap_plans AS plan ON plan.id = step.roadmap_plan_id
		JOIN student_profiles AS profile ON profile.id = plan.student_profile_id
		WHERE task.id = $1 AND plan.is_active AND profile.user_id = $2
		FOR UPDATE OF task
	`, taskID, userID).Scan(&planID, &taskCompleted)
	if errors.Is(err, sql.ErrNoRows) {
		writeAuthError(w, http.StatusNotFound, "roadmap task not found")
		return
	}
	if err != nil {
		writeTrackingError(w, "load task for micro-step", err)
		return
	}
	if taskCompleted {
		writeAuthError(w, http.StatusConflict, "cannot add a micro-step to a completed task")
		return
	}
	var position int
	if err := tx.QueryRowContext(r.Context(), `
		SELECT COALESCE(MAX(position), 0) + 1 FROM roadmap_micro_steps WHERE roadmap_task_id = $1
	`, taskID).Scan(&position); err != nil {
		writeTrackingError(w, "get micro-step position", err)
		return
	}
	var microStep roadmapMicroStep
	err = tx.QueryRowContext(r.Context(), `
		INSERT INTO roadmap_micro_steps (roadmap_task_id, position, title)
		VALUES ($1, $2, $3)
		RETURNING id::text, title, completed
	`, taskID, position, input.Title).Scan(
		&microStep.ID, &microStep.Title, &microStep.Completed,
	)
	if err != nil {
		writeTrackingError(w, "insert micro-step", err)
		return
	}
	if err := tx.Commit(); err != nil {
		writeTrackingError(w, "commit micro-step creation", err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(microStep)
}

type updateMicroStepRequest struct {
	Completed bool `json:"completed"`
}

func (h Roadmap) UpdateMicroStep(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		writeAuthError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	userID, err := authenticatedUserID(r, h.JWTSecret)
	if err != nil {
		writeAuthError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var input updateMicroStepRequest
	if err := decodeAuthRequest(w, r, &input); err != nil {
		writeAuthError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	tx, err := h.DB.BeginTx(r.Context(), nil)
	if err != nil {
		writeTrackingError(w, "begin micro-step update", err)
		return
	}
	defer tx.Rollback()

	microStepID := r.PathValue("microStepID")
	var taskID, planID string
	var wasCompleted bool
	err = tx.QueryRowContext(r.Context(), `
		SELECT task.id::text, plan.id::text, micro.completed
		FROM roadmap_micro_steps AS micro
		JOIN roadmap_tasks AS task ON task.id = micro.roadmap_task_id
		JOIN roadmap_steps AS step ON step.id = task.roadmap_step_id
		JOIN roadmap_plans AS plan ON plan.id = step.roadmap_plan_id
		JOIN student_profiles AS profile ON profile.id = plan.student_profile_id
		WHERE micro.id = $1 AND plan.is_active AND profile.user_id = $2
		FOR UPDATE OF micro
	`, microStepID, userID).Scan(&taskID, &planID, &wasCompleted)
	if errors.Is(err, sql.ErrNoRows) {
		writeAuthError(w, http.StatusNotFound, "micro-step not found")
		return
	}
	if err != nil {
		writeTrackingError(w, "load micro-step for update", err)
		return
	}
	_, err = tx.ExecContext(r.Context(), `
		UPDATE roadmap_micro_steps
		SET completed = $1,
		    completed_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`, input.Completed, microStepID)
	if err != nil {
		writeTrackingError(w, "update micro-step", err)
		return
	}
	if wasCompleted != input.Completed {
		eventType := "micro_step_uncompleted"
		if input.Completed {
			eventType = "micro_step_completed"
		}
		if err := insertRoadmapEvent(r.Context(), tx, taskID, planID, eventType, map[string]string{
			"micro_step_id": microStepID,
		}); err != nil {
			writeTrackingError(w, "record micro-step event", err)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		writeTrackingError(w, "commit micro-step update", err)
		return
	}
	writeTrackingJSON(w, map[string]any{"completed": input.Completed})
}

type roadmapTaskTypeMetrics struct {
	TaskType  string `json:"task_type"`
	Total     int64  `json:"total"`
	Completed int64  `json:"completed"`
}

type roadmapDailyMetrics struct {
	Date                string `json:"date"`
	TasksCompleted      int64  `json:"tasks_completed"`
	MicroStepsCompleted int64  `json:"micro_steps_completed"`
}

type roadmapMetricsResponse struct {
	PlanID              string                   `json:"plan_id"`
	TotalTasks          int64                    `json:"total_tasks"`
	CompletedTasks      int64                    `json:"completed_tasks"`
	OverdueTasks        int64                    `json:"overdue_tasks"`
	TotalMicroSteps     int64                    `json:"total_micro_steps"`
	CompletedMicroSteps int64                    `json:"completed_micro_steps"`
	ByTaskType          []roadmapTaskTypeMetrics `json:"by_task_type"`
	DailyActivity       []roadmapDailyMetrics    `json:"daily_activity"`
}

func (h Roadmap) Metrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeAuthError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	userID, err := authenticatedUserID(r, h.JWTSecret)
	if err != nil {
		writeAuthError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var metrics roadmapMetricsResponse
	metrics.PlanID, err = h.loadActivePlanID(r.Context(), userID)
	if errors.Is(err, sql.ErrNoRows) {
		writeAuthError(w, http.StatusNotFound, "roadmap not found")
		return
	}
	if err != nil {
		writeTrackingError(w, "find active plan for metrics", err)
		return
	}

	err = h.DB.QueryRowContext(r.Context(), `
		SELECT COUNT(task.id),
		       COUNT(task.id) FILTER (WHERE task.completed),
		       COUNT(task.id) FILTER (WHERE task.due_date < CURRENT_DATE AND NOT task.completed)
		FROM roadmap_steps AS step
		LEFT JOIN roadmap_tasks AS task ON task.roadmap_step_id = step.id
		WHERE step.roadmap_plan_id = $1
	`, metrics.PlanID).Scan(&metrics.TotalTasks, &metrics.CompletedTasks, &metrics.OverdueTasks)
	if err != nil {
		writeTrackingError(w, "aggregate task metrics", err)
		return
	}
	err = h.DB.QueryRowContext(r.Context(), `
		SELECT COUNT(micro.id),
		       COUNT(micro.id) FILTER (WHERE micro.completed)
		FROM roadmap_steps AS step
		JOIN roadmap_tasks AS task ON task.roadmap_step_id = step.id
		LEFT JOIN roadmap_micro_steps AS micro ON micro.roadmap_task_id = task.id
		WHERE step.roadmap_plan_id = $1
	`, metrics.PlanID).Scan(&metrics.TotalMicroSteps, &metrics.CompletedMicroSteps)
	if err != nil {
		writeTrackingError(w, "aggregate micro-step metrics", err)
		return
	}

	metrics.ByTaskType = []roadmapTaskTypeMetrics{}
	typeRows, err := h.DB.QueryContext(r.Context(), `
		SELECT COALESCE(task.task_type, 'other'), COUNT(task.id),
		       COUNT(task.id) FILTER (WHERE task.completed)
		FROM roadmap_steps AS step
		JOIN roadmap_tasks AS task ON task.roadmap_step_id = step.id
		WHERE step.roadmap_plan_id = $1
		GROUP BY COALESCE(task.task_type, 'other')
		ORDER BY COALESCE(task.task_type, 'other')
	`, metrics.PlanID)
	if err != nil {
		writeTrackingError(w, "load task type metrics", err)
		return
	}
	for typeRows.Next() {
		var metric roadmapTaskTypeMetrics
		if err := typeRows.Scan(&metric.TaskType, &metric.Total, &metric.Completed); err != nil {
			typeRows.Close()
			writeTrackingError(w, "scan task type metrics", err)
			return
		}
		metrics.ByTaskType = append(metrics.ByTaskType, metric)
	}
	if err := typeRows.Err(); err != nil {
		typeRows.Close()
		writeTrackingError(w, "iterate task type metrics", err)
		return
	}
	if err := typeRows.Close(); err != nil {
		writeTrackingError(w, "close task type metrics", err)
		return
	}

	metrics.DailyActivity = []roadmapDailyMetrics{}
	activityRows, err := h.DB.QueryContext(r.Context(), `
		SELECT created_at::date::text,
		       COUNT(*) FILTER (WHERE event_type = 'completed'),
		       COUNT(*) FILTER (WHERE event_type = 'micro_step_completed')
		FROM roadmap_task_events
		WHERE roadmap_plan_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '13 days'
		GROUP BY created_at::date
		ORDER BY created_at::date
	`, metrics.PlanID)
	if err != nil {
		writeTrackingError(w, "load daily activity metrics", err)
		return
	}
	for activityRows.Next() {
		var activity roadmapDailyMetrics
		if err := activityRows.Scan(&activity.Date, &activity.TasksCompleted, &activity.MicroStepsCompleted); err != nil {
			activityRows.Close()
			writeTrackingError(w, "scan daily activity metrics", err)
			return
		}
		metrics.DailyActivity = append(metrics.DailyActivity, activity)
	}
	if err := activityRows.Err(); err != nil {
		activityRows.Close()
		writeTrackingError(w, "iterate daily activity metrics", err)
		return
	}
	if err := activityRows.Close(); err != nil {
		writeTrackingError(w, "close daily activity metrics", err)
		return
	}

	writeTrackingJSON(w, metrics)
}

func writeTrackingError(w http.ResponseWriter, operation string, err error) {
	log.Printf("roadmap: %s: %v", operation, err)
	writeAuthError(w, http.StatusInternalServerError, "could not update roadmap tracking")
}

func writeTrackingJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(value)
}
