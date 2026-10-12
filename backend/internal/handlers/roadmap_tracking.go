package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"
)

type ownedRoadmapTask struct {
	PlanID    string
	StepID    string
	StartedAt sql.NullTime
	Completed bool
}

func (h Roadmap) StartTask(w http.ResponseWriter, r *http.Request) {
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
		writeTrackingError(w, "start task", err)
		return
	}
	defer tx.Rollback()

	taskID := r.PathValue("taskID")
	task, err := lockOwnedTask(r, tx, userID, taskID)
	if errors.Is(err, sql.ErrNoRows) {
		writeAuthError(w, http.StatusNotFound, "roadmap task not found")
		return
	}
	if err != nil {
		writeTrackingError(w, "load task", err)
		return
	}
	if task.Completed {
		writeAuthError(w, http.StatusConflict, "completed task cannot be started")
		return
	}
	if !task.StartedAt.Valid {
		if _, err := tx.ExecContext(r.Context(), `
			UPDATE roadmap_tasks SET started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1
		`, taskID); err != nil {
			writeTrackingError(w, "start task timer", err)
			return
		}
		if err := insertRoadmapEvent(r.Context(), tx, taskID, task.PlanID, "started", map[string]any{"source": "manual"}); err != nil {
			writeTrackingError(w, "record task start", err)
			return
		}
		task.StartedAt = sql.NullTime{Time: time.Now().UTC(), Valid: true}
		if err := markRoadmapStepInProgress(r, tx, task.StepID); err != nil {
			writeTrackingError(w, "activate roadmap step", err)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		writeTrackingError(w, "commit task start", err)
		return
	}
	writeTrackingJSON(w, map[string]any{"started_at": task.StartedAt.Time})
}

type createMicroStepRequest struct {
	Title            string `json:"title"`
	EstimatedMinutes *int   `json:"estimated_minutes"`
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
	if input.Title == "" || len(input.Title) > 500 || input.EstimatedMinutes == nil || *input.EstimatedMinutes < 1 {
		writeAuthError(w, http.StatusBadRequest, "title is required and estimated_minutes must be positive")
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
		INSERT INTO roadmap_micro_steps (roadmap_task_id, position, title, estimated_minutes)
		VALUES ($1, $2, $3, $4)
		RETURNING id::text, title, estimated_minutes, completed
	`, taskID, position, input.Title, input.EstimatedMinutes).Scan(
		&microStep.ID, &microStep.Title, &microStep.EstimatedMinutes, &microStep.Completed,
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

func (h Roadmap) StartMicroStep(w http.ResponseWriter, r *http.Request) {
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
		writeTrackingError(w, "begin micro-step timer", err)
		return
	}
	defer tx.Rollback()

	microStepID := r.PathValue("microStepID")
	var taskID, planID, stepID string
	var startedAt, taskStartedAt sql.NullTime
	var completed, taskCompleted bool
	err = tx.QueryRowContext(r.Context(), `
		SELECT task.id::text, plan.id::text, step.id::text, micro.started_at, micro.completed,
		       task.started_at, task.completed
		FROM roadmap_micro_steps AS micro
		JOIN roadmap_tasks AS task ON task.id = micro.roadmap_task_id
		JOIN roadmap_steps AS step ON step.id = task.roadmap_step_id
		JOIN roadmap_plans AS plan ON plan.id = step.roadmap_plan_id
		JOIN student_profiles AS profile ON profile.id = plan.student_profile_id
		WHERE micro.id = $1 AND plan.is_active AND profile.user_id = $2
		FOR UPDATE OF micro
	`, microStepID, userID).Scan(&taskID, &planID, &stepID, &startedAt, &completed,
		&taskStartedAt, &taskCompleted)
	if errors.Is(err, sql.ErrNoRows) {
		writeAuthError(w, http.StatusNotFound, "micro-step not found")
		return
	}
	if err != nil {
		writeTrackingError(w, "load micro-step", err)
		return
	}
	if completed || taskCompleted {
		writeAuthError(w, http.StatusConflict, "completed task or micro-step cannot be started")
		return
	}
	if !taskStartedAt.Valid {
		if _, err := tx.ExecContext(r.Context(), `
			UPDATE roadmap_tasks SET started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1
		`, taskID); err != nil {
			writeTrackingError(w, "start parent task timer", err)
			return
		}
		if err := insertRoadmapEvent(r.Context(), tx, taskID, planID, "started", map[string]any{"source": "micro_step"}); err != nil {
			writeTrackingError(w, "record parent task start", err)
			return
		}
		taskStartedAt = sql.NullTime{Time: time.Now().UTC(), Valid: true}
		if err := markRoadmapStepInProgress(r, tx, stepID); err != nil {
			writeTrackingError(w, "activate roadmap step", err)
			return
		}
	}
	if !startedAt.Valid {
		if _, err := tx.ExecContext(r.Context(), `
			UPDATE roadmap_micro_steps SET started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1
		`, microStepID); err != nil {
			writeTrackingError(w, "start micro-step timer", err)
			return
		}
		payload := map[string]string{"micro_step_id": microStepID}
		if err := insertRoadmapEvent(r.Context(), tx, taskID, planID, "micro_step_started", payload); err != nil {
			writeTrackingError(w, "record micro-step start", err)
			return
		}
		startedAt = sql.NullTime{Time: time.Now().UTC(), Valid: true}
	}
	if err := tx.Commit(); err != nil {
		writeTrackingError(w, "commit micro-step start", err)
		return
	}
	writeTrackingJSON(w, map[string]any{"started_at": startedAt.Time})
}

type updateMicroStepRequest struct {
	Completed     bool `json:"completed"`
	ActualMinutes *int `json:"actual_minutes,omitempty"`
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
	if input.ActualMinutes != nil && *input.ActualMinutes < 0 {
		writeAuthError(w, http.StatusBadRequest, "actual_minutes cannot be negative")
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
	var actualMinutes sql.NullInt64
	err = tx.QueryRowContext(r.Context(), `
		UPDATE roadmap_micro_steps
		SET completed = $1,
		    completed_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END,
		    actual_minutes = CASE
		        WHEN $1 THEN COALESCE($2, actual_minutes,
		            CASE WHEN started_at IS NOT NULL
		                THEN GREATEST(1, CEIL(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) / 60)::INTEGER)
		            END)
		        ELSE COALESCE($2, actual_minutes)
		    END,
		    started_at = CASE WHEN $1 THEN started_at ELSE NULL END,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $3
		RETURNING actual_minutes
	`, input.Completed, input.ActualMinutes, microStepID).Scan(&actualMinutes)
	if err != nil {
		writeTrackingError(w, "update micro-step", err)
		return
	}
	if wasCompleted != input.Completed {
		eventType := "micro_step_uncompleted"
		if input.Completed {
			eventType = "micro_step_completed"
		}
		if err := insertRoadmapEvent(r.Context(), tx, taskID, planID, eventType, map[string]any{
			"micro_step_id": microStepID, "actual_minutes": nullInt64Value(actualMinutes),
		}); err != nil {
			writeTrackingError(w, "record micro-step event", err)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		writeTrackingError(w, "commit micro-step update", err)
		return
	}
	response := map[string]any{"completed": input.Completed}
	if actualMinutes.Valid {
		response["actual_minutes"] = actualMinutes.Int64
	}
	writeTrackingJSON(w, response)
}

type roadmapTaskTypeMetrics struct {
	TaskType         string `json:"task_type"`
	Total            int64  `json:"total"`
	Completed        int64  `json:"completed"`
	EstimatedMinutes int64  `json:"estimated_minutes"`
	ActualMinutes    int64  `json:"actual_minutes"`
}

type roadmapDailyMetrics struct {
	Date                string `json:"date"`
	TasksStarted        int64  `json:"tasks_started"`
	TasksCompleted      int64  `json:"tasks_completed"`
	MicroStepsStarted   int64  `json:"micro_steps_started"`
	MicroStepsCompleted int64  `json:"micro_steps_completed"`
}

type roadmapMetricsResponse struct {
	PlanID                    string                   `json:"plan_id"`
	TotalTasks                int64                    `json:"total_tasks"`
	CompletedTasks            int64                    `json:"completed_tasks"`
	StartedTasks              int64                    `json:"started_tasks"`
	OverdueTasks              int64                    `json:"overdue_tasks"`
	EstimatedMinutes          int64                    `json:"estimated_minutes"`
	ActualMinutes             int64                    `json:"actual_minutes"`
	TotalMicroSteps           int64                    `json:"total_micro_steps"`
	CompletedMicroSteps       int64                    `json:"completed_micro_steps"`
	EstimatedMicroStepMinutes int64                    `json:"estimated_micro_step_minutes"`
	ActualMicroStepMinutes    int64                    `json:"actual_micro_step_minutes"`
	ByTaskType                []roadmapTaskTypeMetrics `json:"by_task_type"`
	DailyActivity             []roadmapDailyMetrics    `json:"daily_activity"`
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
	err = h.DB.QueryRowContext(r.Context(), `
		SELECT id::text FROM roadmap_plans
		WHERE student_profile_id = (
			SELECT id FROM student_profiles WHERE user_id = $1
		) AND is_active
	`, userID).Scan(&metrics.PlanID)
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
		       COUNT(task.id) FILTER (WHERE task.started_at IS NOT NULL AND NOT task.completed),
		       COUNT(task.id) FILTER (WHERE task.due_date < CURRENT_DATE AND NOT task.completed),
		       COALESCE(SUM(task.estimated_minutes), 0),
		       COALESCE(SUM(task.actual_minutes), 0)
		FROM roadmap_steps AS step
		LEFT JOIN roadmap_tasks AS task ON task.roadmap_step_id = step.id
		WHERE step.roadmap_plan_id = $1
	`, metrics.PlanID).Scan(&metrics.TotalTasks, &metrics.CompletedTasks, &metrics.StartedTasks,
		&metrics.OverdueTasks, &metrics.EstimatedMinutes, &metrics.ActualMinutes)
	if err != nil {
		writeTrackingError(w, "aggregate task metrics", err)
		return
	}
	err = h.DB.QueryRowContext(r.Context(), `
		SELECT COUNT(micro.id),
		       COUNT(micro.id) FILTER (WHERE micro.completed),
		       COALESCE(SUM(micro.estimated_minutes), 0),
		       COALESCE(SUM(micro.actual_minutes), 0)
		FROM roadmap_steps AS step
		JOIN roadmap_tasks AS task ON task.roadmap_step_id = step.id
		LEFT JOIN roadmap_micro_steps AS micro ON micro.roadmap_task_id = task.id
		WHERE step.roadmap_plan_id = $1
	`, metrics.PlanID).Scan(&metrics.TotalMicroSteps, &metrics.CompletedMicroSteps,
		&metrics.EstimatedMicroStepMinutes, &metrics.ActualMicroStepMinutes)
	if err != nil {
		writeTrackingError(w, "aggregate micro-step metrics", err)
		return
	}

	metrics.ByTaskType = []roadmapTaskTypeMetrics{}
	typeRows, err := h.DB.QueryContext(r.Context(), `
		SELECT COALESCE(task.task_type, 'other'), COUNT(task.id),
		       COUNT(task.id) FILTER (WHERE task.completed),
		       COALESCE(SUM(task.estimated_minutes), 0),
	       COALESCE(SUM(task.actual_minutes), 0)
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
		if err := typeRows.Scan(&metric.TaskType, &metric.Total, &metric.Completed,
			&metric.EstimatedMinutes, &metric.ActualMinutes); err != nil {
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
		       COUNT(*) FILTER (WHERE event_type = 'started'),
		       COUNT(*) FILTER (WHERE event_type = 'completed'),
	       COUNT(*) FILTER (WHERE event_type = 'micro_step_started'),
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
		if err := activityRows.Scan(&activity.Date, &activity.TasksStarted, &activity.TasksCompleted,
			&activity.MicroStepsStarted, &activity.MicroStepsCompleted); err != nil {
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

func lockOwnedTask(r *http.Request, tx *sql.Tx, userID, taskID string) (ownedRoadmapTask, error) {
	var task ownedRoadmapTask
	err := tx.QueryRowContext(r.Context(), `
		SELECT plan.id::text, step.id::text, task.started_at, task.completed
		FROM roadmap_tasks AS task
		JOIN roadmap_steps AS step ON step.id = task.roadmap_step_id
		JOIN roadmap_plans AS plan ON plan.id = step.roadmap_plan_id
		JOIN student_profiles AS profile ON profile.id = plan.student_profile_id
		WHERE task.id = $1 AND plan.is_active AND profile.user_id = $2
		FOR UPDATE OF task
	`, taskID, userID).Scan(&task.PlanID, &task.StepID, &task.StartedAt, &task.Completed)
	return task, err
}

func markRoadmapStepInProgress(r *http.Request, tx *sql.Tx, stepID string) error {
	_, err := tx.ExecContext(r.Context(), `
		UPDATE roadmap_steps SET status = 'in_progress'
		WHERE id = $1 AND status <> 'completed'
	`, stepID)
	return err
}

func nullInt64Value(value sql.NullInt64) any {
	if !value.Valid {
		return nil
	}
	return value.Int64
}

func writeTrackingError(w http.ResponseWriter, operation string, err error) {
	log.Printf("roadmap: %s: %v", operation, err)
	writeAuthError(w, http.StatusInternalServerError, "could not update roadmap tracking")
}

func writeTrackingJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(value)
}
