package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/lib/pq"
	"google.golang.org/genai"
)

type Roadmap struct {
	DB        *sql.DB
	JWTSecret []byte
	APIKey    string
	Model     string
	generator geminiTextGenerator
}

const maxLLMModelAttempts = 4
const minRoadmapMilestones = 4
const maxRoadmapMilestones = 5
const minRoadmapTasksPerMilestone = 2
const maxRoadmapTasksPerMilestone = 4

const roadmapSystemInstruction = "Ты эксперт и консультант по академическому планированию для школьников. Верни ТОЛЬКО валидный JSON-объект без markdown-разметки (без ```json). Построй реалистичный персонализированный план развития от текущего класса ученика до конца школьного обучения. Учитывай интересы, сильные стороны, точки роста и текущий этап портфолио. Разбей план на этапы по учебным годам. В плане ориентируйся на целевые экзамены ученика (SAT, IELTS, TOEFL, NUET, олимпиады, школьные выпускные экзамены и т.д.), полностью исключая специфику ОГЭ/ЕГЭ. Не придумывай гарантированные результаты и точные даты проведения экзаменов."
const maxRoadmapPreferencesLength = 2000

type geminiTextGenerator interface {
	Generate(ctx context.Context, model, prompt string) (string, error)
}

type geminiSDKGenerator struct {
	client *genai.Client
}

//

func (g geminiSDKGenerator) Generate(ctx context.Context, model, prompt string) (string, error) {
	response, err := g.client.Models.GenerateContent(ctx, model,
		[]*genai.Content{genai.NewContentFromText(prompt, "user")},
		&genai.GenerateContentConfig{
			SystemInstruction: genai.NewContentFromText(roadmapSystemInstruction, ""),
			Temperature:       genai.Ptr(float32(0.4)),
			ResponseMIMEType:  "application/json",
		},
	)
	if err != nil {
		return "", err
	}
	if response == nil {
		return "", errors.New("Gemini returned an empty response")
	}
	return response.Text(), nil
}

type roadmapProfile struct {
	SchoolGrade    int      `json:"school_grade"`
	Interests      []string `json:"interests"`
	Strengths      []string `json:"strengths"`
	Weaknesses     []string `json:"weaknesses"`
	PortfolioStage string   `json:"portfolio_stage"`
}

type generateRoadmapRequest struct {
	Preferences string `json:"preferences"`
}

type roadmapPlan struct {
	PlanID            string        `json:"plan_id,omitempty"`
	Title             string        `json:"title"`
	Summary           string        `json:"summary"`
	StartGrade        int           `json:"start_grade"`
	EndGrade          int           `json:"end_grade"`
	StartAcademicYear string        `json:"start_academic_year"`
	EndAcademicYear   string        `json:"end_academic_year"`
	Steps             []roadmapStep `json:"steps"`
}

type roadmapStep struct {
	ID            string        `json:"id"`
	Phase         string        `json:"phase"`
	Title         string        `json:"title"`
	Description   string        `json:"description"`
	Status        string        `json:"status"`
	EstimatedTime string        `json:"estimatedTime"`
	ImpactScore   int           `json:"impactScore"`
	Tasks         []roadmapTask `json:"tasks"`
	Artifacts     []string      `json:"artifacts"`
}

type roadmapTask struct {
	ID            string             `json:"id"`
	SourceID      string             `json:"source_id,omitempty"`
	Title         string             `json:"title"`
	TaskType      string             `json:"task_type"`
	DueDate       *string            `json:"due_date,omitempty"`
	DueDateSource *string            `json:"due_date_source,omitempty"`
	Completed     bool               `json:"completed"`
	CompletedAt   *time.Time         `json:"completed_at,omitempty"`
	MicroSteps    []roadmapMicroStep `json:"micro_steps"`
}

type roadmapMicroStep struct {
	ID          string     `json:"id,omitempty"`
	Title       string     `json:"title"`
	Completed   bool       `json:"completed"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

func (h Roadmap) Generate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeAuthError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if h.APIKey == "" {
		writeAuthError(w, http.StatusServiceUnavailable, "roadmap generation is not configured")
		return
	}

	userID, err := authenticatedUserID(r, h.JWTSecret)
	if err != nil {
		writeAuthError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var input generateRoadmapRequest
	if err := decodeAuthRequest(w, r, &input); err != nil {
		writeAuthError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	input.Preferences = strings.TrimSpace(input.Preferences)
	if len([]rune(input.Preferences)) > maxRoadmapPreferencesLength {
		writeAuthError(w, http.StatusBadRequest, "preferences must be 2000 characters or fewer")
		return
	}

	profile, err := h.loadStudentProfile(r.Context(), userID)
	if errors.Is(err, sql.ErrNoRows) {
		writeAuthError(w, http.StatusNotFound, "student profile not found")
		return
	}
	if err != nil {
		log.Printf("roadmap: load student profile: %v", err)
		writeAuthError(w, http.StatusInternalServerError, "could not load student profile")
		return
	}
	if profile.SchoolGrade < 7 || profile.SchoolGrade > 11 {
		writeAuthError(w, http.StatusUnprocessableEntity, "student profile has an invalid school grade")
		return
	}

	startYear, endYear := academicYearRange(time.Now(), profile.SchoolGrade)
	generationCtx, cancel := context.WithTimeout(r.Context(), 3*time.Minute)
	defer cancel()
	plan, err := h.generatePlan(generationCtx, profile, input.Preferences, startYear, endYear)
	if err != nil {
		log.Printf("roadmap: generate plan: %v", err)
		writeAuthError(w, http.StatusBadGateway, "could not generate roadmap")
		return
	}
	for stepIndex := range plan.Steps {
		for taskIndex := range plan.Steps[stepIndex].Tasks {
			plan.Steps[stepIndex].Tasks[taskIndex].Completed = false
		}
	}
	plan.PlanID, err = h.savePlan(r.Context(), userID, plan)
	if err != nil {
		log.Printf("roadmap: save generated plan: %v", err)
		writeAuthError(w, http.StatusInternalServerError, "could not save roadmap")
		return
	}
	plan, err = h.loadActivePlan(r.Context(), userID)
	if err != nil {
		log.Printf("roadmap: reload generated plan: %v", err)
		writeAuthError(w, http.StatusInternalServerError, "could not load saved roadmap")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(plan)
}

func (h Roadmap) Current(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeAuthError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	userID, err := authenticatedUserID(r, h.JWTSecret)
	if err != nil {
		writeAuthError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	plan, err := h.loadActivePlan(r.Context(), userID)
	if errors.Is(err, sql.ErrNoRows) {
		writeAuthError(w, http.StatusNotFound, "roadmap not found")
		return
	}
	if err != nil {
		log.Printf("roadmap: load active plan: %v", err)
		writeAuthError(w, http.StatusInternalServerError, "could not load roadmap")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(plan)
}

type updateRoadmapTaskRequest struct {
	Completed bool `json:"completed"`
}

func (h Roadmap) UpdateTask(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		writeAuthError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	userID, err := authenticatedUserID(r, h.JWTSecret)
	if err != nil {
		writeAuthError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	var input updateRoadmapTaskRequest
	if err := decodeAuthRequest(w, r, &input); err != nil {
		writeAuthError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	tx, err := h.DB.BeginTx(r.Context(), nil)
	if err != nil {
		log.Printf("roadmap: begin task update: %v", err)
		writeAuthError(w, http.StatusInternalServerError, "could not update task")
		return
	}
	defer tx.Rollback()

	var planID, stepID string
	var wasCompleted bool
	err = tx.QueryRowContext(r.Context(), `
		SELECT plan.id::text, step.id::text, task.completed
		FROM roadmap_tasks AS task
		JOIN roadmap_steps AS step ON step.id = task.roadmap_step_id
		JOIN roadmap_plans AS plan ON plan.id = step.roadmap_plan_id
		JOIN student_profiles AS profile ON profile.id = plan.student_profile_id
		WHERE task.id = $1 AND plan.is_active AND profile.user_id = $2
		FOR UPDATE OF task
	`, r.PathValue("taskID"), userID).Scan(&planID, &stepID, &wasCompleted)
	if errors.Is(err, sql.ErrNoRows) {
		writeAuthError(w, http.StatusNotFound, "roadmap task not found")
		return
	}
	if err != nil {
		log.Printf("roadmap: update task: %v", err)
		writeAuthError(w, http.StatusInternalServerError, "could not update task")
		return
	}
	if wasCompleted != input.Completed {
		_, err = tx.ExecContext(r.Context(), `
			UPDATE roadmap_tasks
			SET completed = $1,
			    completed_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END,
			    updated_at = CURRENT_TIMESTAMP
			WHERE id = $2
		`, input.Completed, r.PathValue("taskID"))
		if err != nil {
			log.Printf("roadmap: update task completion: %v", err)
			writeAuthError(w, http.StatusInternalServerError, "could not update task completion")
			return
		}
		eventType := "uncompleted"
		if input.Completed {
			eventType = "completed"
		}
		if err := insertRoadmapEvent(r.Context(), tx, r.PathValue("taskID"), planID, eventType, map[string]any{}); err != nil {
			log.Printf("roadmap: log task event: %v", err)
			writeAuthError(w, http.StatusInternalServerError, "could not record task event")
			return
		}
	}

	var stepStatus string
	err = tx.QueryRowContext(r.Context(), `
		UPDATE roadmap_steps AS step
		SET status = CASE
		    WHEN NOT EXISTS (
		        SELECT 1 FROM roadmap_tasks WHERE roadmap_step_id = step.id AND NOT completed
		    ) THEN 'completed'
		    WHEN EXISTS (
		        SELECT 1 FROM roadmap_tasks WHERE roadmap_step_id = step.id AND completed
		    ) THEN 'in_progress'
		    ELSE 'upcoming'
		END
		WHERE step.id = $1
		RETURNING status
	`, stepID).Scan(&stepStatus)
	if err != nil {
		log.Printf("roadmap: update step status: %v", err)
		writeAuthError(w, http.StatusInternalServerError, "could not update roadmap step")
		return
	}
	if err := tx.Commit(); err != nil {
		log.Printf("roadmap: commit task update: %v", err)
		writeAuthError(w, http.StatusInternalServerError, "could not update task")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"step_status": stepStatus})
}

func insertRoadmapEvent(ctx context.Context, tx *sql.Tx, taskID, planID, eventType string, payload any) error {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encode event payload: %w", err)
	}
	_, err = tx.ExecContext(ctx, `
		INSERT INTO roadmap_task_events (roadmap_task_id, roadmap_plan_id, event_type, payload)
		VALUES ($1, $2, $3, $4::jsonb)
	`, taskID, planID, eventType, string(encoded))
	if err != nil {
		return fmt.Errorf("insert roadmap event: %w", err)
	}
	return nil
}

func (h Roadmap) savePlan(ctx context.Context, userID string, plan roadmapPlan) (string, error) {
	tx, err := h.DB.BeginTx(ctx, nil)
	if err != nil {
		return "", fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	var profileID string
	err = tx.QueryRowContext(ctx, `
		SELECT id::text FROM student_profiles WHERE user_id = $1 FOR UPDATE
	`, userID).Scan(&profileID)
	if err != nil {
		return "", fmt.Errorf("find student profile: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE roadmap_plans SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
		WHERE student_profile_id = $1 AND is_active
	`, profileID); err != nil {
		return "", fmt.Errorf("deactivate previous plan: %w", err)
	}

	var planID string
	err = tx.QueryRowContext(ctx, `
		INSERT INTO roadmap_plans (
			student_profile_id, title, summary, start_grade, end_grade,
			start_academic_year, end_academic_year, is_active
		) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
		RETURNING id::text
	`, profileID, plan.Title, plan.Summary, plan.StartGrade, plan.EndGrade,
		plan.StartAcademicYear, plan.EndAcademicYear).Scan(&planID)
	if err != nil {
		return "", fmt.Errorf("insert roadmap plan: %w", err)
	}

	for stepIndex, step := range plan.Steps {
		var stepID string
		err := tx.QueryRowContext(ctx, `
			INSERT INTO roadmap_steps (
				roadmap_plan_id, source_id, position, phase, title, description,
				status, estimated_time, impact_score
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			RETURNING id::text
		`, planID, step.ID, stepIndex+1, step.Phase, step.Title, step.Description,
			step.Status, step.EstimatedTime, step.ImpactScore).Scan(&stepID)
		if err != nil {
			return "", fmt.Errorf("insert roadmap step %q: %w", step.ID, err)
		}

		for taskIndex, task := range step.Tasks {
			taskType := task.TaskType
			if taskType == "" {
				taskType = "other"
			}
			dueDateSource := task.DueDateSource
			if task.DueDate != nil && dueDateSource == nil {
				generatedSource := "generated"
				dueDateSource = &generatedSource
			}
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO roadmap_tasks (
					roadmap_step_id, source_id, position, title, task_type,
					due_date, due_date_source
				) VALUES ($1, $2, $3, $4, $5, $6, $7)
			`, stepID, task.ID, taskIndex+1, task.Title, taskType, task.DueDate, dueDateSource); err != nil {
				return "", fmt.Errorf("insert roadmap task %q: %w", task.ID, err)
			}
			var taskDBID string
			if err := tx.QueryRowContext(ctx, `
				SELECT id::text FROM roadmap_tasks WHERE roadmap_step_id = $1 AND source_id = $2
			`, stepID, task.ID).Scan(&taskDBID); err != nil {
				return "", fmt.Errorf("find inserted roadmap task %q: %w", task.ID, err)
			}
			for microIndex, microStep := range task.MicroSteps {
				if _, err := tx.ExecContext(ctx, `
					INSERT INTO roadmap_micro_steps (roadmap_task_id, position, title)
					VALUES ($1, $2, $3)
				`, taskDBID, microIndex+1, microStep.Title); err != nil {
					return "", fmt.Errorf("insert micro-step for task %q: %w", task.ID, err)
				}
			}
		}

		for artifactIndex, artifact := range step.Artifacts {
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO roadmap_artifacts (roadmap_step_id, position, title)
				VALUES ($1, $2, $3)
			`, stepID, artifactIndex+1, artifact); err != nil {
				return "", fmt.Errorf("insert roadmap artifact for step %q: %w", step.ID, err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return "", fmt.Errorf("commit roadmap plan: %w", err)
	}
	return planID, nil
}

func (h Roadmap) loadActivePlan(ctx context.Context, userID string) (roadmapPlan, error) {
	tx, err := h.DB.BeginTx(ctx, &sql.TxOptions{ReadOnly: true, Isolation: sql.LevelRepeatableRead})
	if err != nil {
		return roadmapPlan{}, fmt.Errorf("begin read transaction: %w", err)
	}
	defer tx.Rollback()

	var plan roadmapPlan
	err = tx.QueryRowContext(ctx, `
		SELECT plan.id::text, plan.title, plan.summary, plan.start_grade, plan.end_grade,
		       plan.start_academic_year, plan.end_academic_year
		FROM roadmap_plans AS plan
		JOIN student_profiles AS profile ON profile.id = plan.student_profile_id
		WHERE profile.user_id = $1 AND plan.is_active
	`, userID).Scan(&plan.PlanID, &plan.Title, &plan.Summary, &plan.StartGrade, &plan.EndGrade,
		&plan.StartAcademicYear, &plan.EndAcademicYear)
	if err != nil {
		return roadmapPlan{}, err
	}

	stepRows, err := tx.QueryContext(ctx, `
		SELECT id::text, source_id, phase, title, description, status,
		       estimated_time, impact_score
		FROM roadmap_steps
		WHERE roadmap_plan_id = $1
		ORDER BY position
	`, plan.PlanID)
	if err != nil {
		return roadmapPlan{}, fmt.Errorf("load roadmap steps: %w", err)
	}
	type storedStep struct {
		step roadmapStep
		dbID string
	}
	var storedSteps []storedStep
	for stepRows.Next() {
		var item storedStep
		if err := stepRows.Scan(&item.dbID, &item.step.ID, &item.step.Phase, &item.step.Title,
			&item.step.Description, &item.step.Status, &item.step.EstimatedTime, &item.step.ImpactScore); err != nil {
			stepRows.Close()
			return roadmapPlan{}, fmt.Errorf("scan roadmap step: %w", err)
		}
		item.step.Tasks = []roadmapTask{}
		item.step.Artifacts = []string{}
		storedSteps = append(storedSteps, item)
	}
	if err := stepRows.Err(); err != nil {
		stepRows.Close()
		return roadmapPlan{}, fmt.Errorf("iterate roadmap steps: %w", err)
	}
	if err := stepRows.Close(); err != nil {
		return roadmapPlan{}, fmt.Errorf("close roadmap steps: %w", err)
	}

	for _, item := range storedSteps {
		taskRows, err := tx.QueryContext(ctx, `
			SELECT id::text, source_id, title, task_type,
			       due_date::text, due_date_source, completed, completed_at
			FROM roadmap_tasks
			WHERE roadmap_step_id = $1
			ORDER BY position
		`, item.dbID)
		if err != nil {
			return roadmapPlan{}, fmt.Errorf("load roadmap tasks: %w", err)
		}
		var tasks []roadmapTask
		for taskRows.Next() {
			var task roadmapTask
			var dueDate, dueDateSource sql.NullString
			var taskType sql.NullString
			var completedAt sql.NullTime
			if err := taskRows.Scan(&task.ID, &task.SourceID, &task.Title, &taskType,
				&dueDate, &dueDateSource, &task.Completed, &completedAt); err != nil {
				taskRows.Close()
				return roadmapPlan{}, fmt.Errorf("scan roadmap task: %w", err)
			}
			if taskType.Valid {
				task.TaskType = taskType.String
			} else {
				task.TaskType = "other"
			}
			if dueDate.Valid {
				task.DueDate = &dueDate.String
			}
			if dueDateSource.Valid {
				task.DueDateSource = &dueDateSource.String
			}
			if completedAt.Valid {
				task.CompletedAt = &completedAt.Time
			}
			task.MicroSteps = []roadmapMicroStep{}
			tasks = append(tasks, task)
		}
		if err := taskRows.Err(); err != nil {
			taskRows.Close()
			return roadmapPlan{}, fmt.Errorf("iterate roadmap tasks: %w", err)
		}
		if err := taskRows.Close(); err != nil {
			return roadmapPlan{}, fmt.Errorf("close roadmap tasks: %w", err)
		}

		for taskIndex := range tasks {
			task := &tasks[taskIndex]
			microRows, err := tx.QueryContext(ctx, `
				SELECT id::text, title, completed, completed_at
				FROM roadmap_micro_steps
				WHERE roadmap_task_id = $1
				ORDER BY position
			`, task.ID)
			if err != nil {
				return roadmapPlan{}, fmt.Errorf("load roadmap micro-steps: %w", err)
			}
			for microRows.Next() {
				var microStep roadmapMicroStep
				var microCompleted sql.NullTime
				if err := microRows.Scan(&microStep.ID, &microStep.Title, &microStep.Completed, &microCompleted); err != nil {
					microRows.Close()
					return roadmapPlan{}, fmt.Errorf("scan roadmap micro-step: %w", err)
				}
				if microCompleted.Valid {
					microStep.CompletedAt = &microCompleted.Time
				}
				task.MicroSteps = append(task.MicroSteps, microStep)
			}
			if err := microRows.Err(); err != nil {
				microRows.Close()
				return roadmapPlan{}, fmt.Errorf("iterate roadmap micro-steps: %w", err)
			}
			if err := microRows.Close(); err != nil {
				return roadmapPlan{}, fmt.Errorf("close roadmap micro-steps: %w", err)
			}
			item.step.Tasks = append(item.step.Tasks, *task)
		}

		artifactRows, err := tx.QueryContext(ctx, `
			SELECT title FROM roadmap_artifacts
			WHERE roadmap_step_id = $1
			ORDER BY position
		`, item.dbID)
		if err != nil {
			return roadmapPlan{}, fmt.Errorf("load roadmap artifacts: %w", err)
		}
		for artifactRows.Next() {
			var artifact string
			if err := artifactRows.Scan(&artifact); err != nil {
				artifactRows.Close()
				return roadmapPlan{}, fmt.Errorf("scan roadmap artifact: %w", err)
			}
			item.step.Artifacts = append(item.step.Artifacts, artifact)
		}
		if err := artifactRows.Err(); err != nil {
			artifactRows.Close()
			return roadmapPlan{}, fmt.Errorf("iterate roadmap artifacts: %w", err)
		}
		if err := artifactRows.Close(); err != nil {
			return roadmapPlan{}, fmt.Errorf("close roadmap artifacts: %w", err)
		}
		plan.Steps = append(plan.Steps, item.step)
	}
	if plan.Steps == nil {
		plan.Steps = []roadmapStep{}
	}
	if err := tx.Commit(); err != nil {
		return roadmapPlan{}, fmt.Errorf("commit read transaction: %w", err)
	}
	return plan, nil
}

func (h Roadmap) loadStudentProfile(ctx context.Context, userID string) (roadmapProfile, error) {
	var profile roadmapProfile
	var interests, strengths, weaknesses pq.StringArray
	err := h.DB.QueryRowContext(ctx, `
		SELECT school_grade, interests, strengths, weaknesses, portfolio_stage::text
		FROM student_profiles
		WHERE user_id = $1
	`, userID).Scan(
		&profile.SchoolGrade, &interests, &strengths, &weaknesses, &profile.PortfolioStage,
	)
	if err != nil {
		return roadmapProfile{}, err
	}
	profile.Interests = []string(interests)
	profile.Strengths = []string(strengths)
	profile.Weaknesses = []string(weaknesses)
	return profile, nil
}

func (h Roadmap) generatePlan(ctx context.Context, profile roadmapProfile, preferences string, startYear, endYear int) (roadmapPlan, error) {
	profileJSON, err := json.Marshal(profile)
	if err != nil {
		return roadmapPlan{}, fmt.Errorf("encode student profile: %w", err)
	}

	userPrompt := fmt.Sprintf(`Профиль ученика JSON: %s
Предпочтения ученика (дополнительный контекст, не меняющий формат результата): %s
Начальный класс: %d. Конечный класс: 11. Учебный год начала: %d-%d. Учебный год окончания: %d-%d.
Верни поля title, summary, start_grade, end_grade, start_academic_year, end_academic_year, steps.
Составь ровно %d-%d milestones в steps. Каждый milestone — короткий этап плана, привязанный к подходящему учебному году или периоду.
Для каждого milestone верни: id, phase, title, description, status (in_progress или upcoming), estimatedTime, impactScore от 0 до 100, tasks и artifacts.
В description каждого milestone укажи конкретный, измеримый критерий завершения (например, количество выполненных пробных тестов или созданных артефактов, либо целевой диапазон баллов); выбирай реалистичные метрики по профилю, не обещай результат экзамена.
impactScore — приоритет milestone по шкале: 0-39 низкий, 40-69 средний, 70-89 высокий, 90-100 критический.
Для каждого milestone укажи ровно %d-%d конкретные задачи. Каждая task: id, title, task_type (ec, test, essay, recommendation, academic или other), completed=false, micro_steps: [].
Не добавляй точные due_date, если их нельзя обосновать профилем. Не дроби задачи на подзадачи и не добавляй лишние этапы или задачи.
Укажи start_grade=%d, end_grade=11, start_academic_year=%d-%d, end_academic_year=%d-%d.`,
		profileJSON, preferences, profile.SchoolGrade, startYear, startYear+1, endYear, endYear+1,
		minRoadmapMilestones, maxRoadmapMilestones, minRoadmapTasksPerMilestone, maxRoadmapTasksPerMilestone,
		profile.SchoolGrade, startYear, startYear+1, endYear, endYear+1)

	generator := h.generator
	if generator == nil {
		client, err := genai.NewClient(ctx, &genai.ClientConfig{
			APIKey:  h.APIKey,
			Backend: genai.BackendGeminiAPI,
			HTTPClient: &http.Client{
				Timeout: 45 * time.Second,
			},
		})
		if err != nil {
			return roadmapPlan{}, fmt.Errorf("create Gemini client: %w", err)
		}
		generator = geminiSDKGenerator{client: client}
	}

	var failures []error
	models := h.modelCandidates()
	for _, model := range models {
		plan, err := h.generatePlanWithModel(ctx, generator, model, userPrompt)
		if err == nil {
			err = validateRoadmapPlan(plan, profile.SchoolGrade, startYear, endYear)
		}
		if err == nil {
			return plan, nil
		}
		failures = append(failures, fmt.Errorf("model %q: %w", model, err))
		log.Printf("roadmap: model %q failed: %v", model, err)
		if ctx.Err() != nil {
			break
		}
	}
	return roadmapPlan{}, errors.Join(failures...)
}

func (h Roadmap) modelCandidates() []string {
	models := make([]string, 0, maxLLMModelAttempts)
	seen := make(map[string]struct{})
	for _, candidate := range strings.Split(h.Model, ",") {
		model := strings.TrimSpace(candidate)
		if model == "" {
			continue
		}
		if _, exists := seen[model]; exists {
			continue
		}
		seen[model] = struct{}{}
		models = append(models, model)
		if len(models) == maxLLMModelAttempts {
			break
		}
	}
	if len(models) == 0 {
		return []string{"gemini-2.5-flash"}
	}
	return models
}

func (h Roadmap) generatePlanWithModel(ctx context.Context, generator geminiTextGenerator, model, userPrompt string) (roadmapPlan, error) {
	content, err := generator.Generate(ctx, model, userPrompt)
	if err != nil {
		return roadmapPlan{}, fmt.Errorf("generate with Gemini: %w", err)
	}
	var plan roadmapPlan
	if err := json.Unmarshal([]byte(content), &plan); err != nil {
		return roadmapPlan{}, fmt.Errorf("decode generated plan: %w", err)
	}
	return plan, nil
}

func academicYearRange(now time.Time, schoolGrade int) (int, int) {
	startYear := now.Year()
	if now.Month() < time.September {
		startYear--
	}
	return startYear, startYear + 11 - schoolGrade
}

func validateRoadmapPlan(plan roadmapPlan, schoolGrade, startYear, endYear int) error {
	if strings.TrimSpace(plan.Title) == "" || strings.TrimSpace(plan.Summary) == "" {
		return errors.New("plan title or summary is empty")
	}
	if plan.StartGrade != schoolGrade || plan.EndGrade != 11 ||
		plan.StartAcademicYear != fmt.Sprintf("%d-%d", startYear, startYear+1) ||
		plan.EndAcademicYear != fmt.Sprintf("%d-%d", endYear, endYear+1) {
		return errors.New("plan does not match requested grade range")
	}
	if len(plan.Steps) < minRoadmapMilestones || len(plan.Steps) > maxRoadmapMilestones {
		return errors.New("plan has an invalid milestone count")
	}
	for _, step := range plan.Steps {
		if step.ID == "" || step.Phase == "" || step.Title == "" || step.Description == "" ||
			(step.Status != "in_progress" && step.Status != "upcoming") ||
			step.ImpactScore < 0 || step.ImpactScore > 100 ||
			len(step.Tasks) < minRoadmapTasksPerMilestone || len(step.Tasks) > maxRoadmapTasksPerMilestone {
			return errors.New("plan contains an invalid step")
		}
		for _, task := range step.Tasks {
			if task.ID == "" || len(task.ID) > 100 || task.Title == "" ||
				!validRoadmapTaskType(task.TaskType) ||
				(task.DueDate != nil && !validDate(*task.DueDate)) || len(task.MicroSteps) > 0 {
				return errors.New("plan contains an invalid task")
			}
		}
	}
	return nil
}

func validRoadmapTaskType(taskType string) bool {
	switch taskType {
	case "ec", "test", "essay", "recommendation", "academic", "other":
		return true
	default:
		return false
	}
}

func validDate(value string) bool {
	_, err := time.Parse("2006-01-02", value)
	return err == nil
}
