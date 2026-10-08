package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/lib/pq"
)

type Roadmap struct {
	DB        *sql.DB
	JWTSecret []byte
	APIKey    string
	BaseURL   string
	Model     string
}

const maxLLMModelAttempts = 4

type roadmapProfile struct {
	SchoolGrade    int      `json:"school_grade"`
	Interests      []string `json:"interests"`
	Strengths      []string `json:"strengths"`
	Weaknesses     []string `json:"weaknesses"`
	PortfolioStage string   `json:"portfolio_stage"`
}

type roadmapPlan struct {
	Title             string        `json:"title"`
	Summary           string        `json:"summary"`
	StartGrade        int           `json:"start_grade"`
	EndGrade          int           `json:"end_grade"`
	StartAcademicYear string        `json:"start_academic_year"`
	EndAcademicYear   string        `json:"end_academic_year"`
	WeeklyHours       int           `json:"weekly_hours"`
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
	ID        string `json:"id"`
	Title     string `json:"title"`
	Duration  string `json:"duration"`
	Completed bool   `json:"completed"`
}

type chatCompletionRequest struct {
	Model          string         `json:"model"`
	Messages       []chatMessage  `json:"messages"`
	ResponseFormat responseFormat `json:"response_format"`
	Temperature    float64        `json:"temperature"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type responseFormat struct {
	Type string `json:"type"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
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

	userID, err := h.authenticatedUserID(r)
	if err != nil {
		writeAuthError(w, http.StatusUnauthorized, "authentication required")
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
	generationCtx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()
	plan, err := h.generatePlan(generationCtx, profile, startYear, endYear)
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

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(plan)
}

func (h Roadmap) authenticatedUserID(r *http.Request) (string, error) {
	header := strings.Fields(r.Header.Get("Authorization"))
	if len(header) != 2 || !strings.EqualFold(header[0], "Bearer") {
		return "", errors.New("missing bearer token")
	}

	claims := &jwt.RegisteredClaims{}
	token, err := jwt.ParseWithClaims(header[1], claims, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return h.JWTSecret, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil || !token.Valid || claims.Subject == "" {
		return "", errors.New("invalid bearer token")
	}
	return claims.Subject, nil
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

func (h Roadmap) generatePlan(ctx context.Context, profile roadmapProfile, startYear, endYear int) (roadmapPlan, error) {
	profileJSON, err := json.Marshal(profile)
	if err != nil {
		return roadmapPlan{}, fmt.Errorf("encode student profile: %w", err)
	}

	messages := []chatMessage{
		{
			Role:    "system",
			Content: "Ты консультант по школьному академическому планированию. Верни только JSON-объект без markdown. Построй реалистичный, персонализированный план от текущего класса ученика до конца 11 класса. Учитывай интересы, сильные стороны, точки роста и этап портфолио. Разбей план на этапы по учебным годам; не придумывай гарантированные результаты и точные даты экзаменов.",
		},
		{
			Role: "user",
			Content: fmt.Sprintf("Профиль ученика JSON: %s\nНачальный класс: %d. Конечный класс: 11. Учебный год начала: %d-%d. Учебный год окончания: %d-%d.\nВерни поля title, summary, start_grade, end_grade, start_academic_year, end_academic_year, weekly_hours, steps. Каждый step должен иметь id, phase, title, description, status (in_progress или upcoming), estimatedTime, impactScore (0-100), tasks и artifacts. Каждая task: id, title, duration, completed=false. Укажи start_grade=%d, end_grade=11, start_academic_year=%d-%d, end_academic_year=%d-%d.",
				profileJSON, profile.SchoolGrade, startYear, startYear+1, endYear, endYear+1,
				profile.SchoolGrade, startYear, startYear+1, endYear, endYear+1),
		},
	}

	var failures []error
	models := h.modelCandidates()
	for _, model := range models {
		plan, err := h.generatePlanWithModel(ctx, model, messages)
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
		return []string{"gpt-4o-mini"}
	}
	return models
}

func (h Roadmap) generatePlanWithModel(ctx context.Context, model string, messages []chatMessage) (roadmapPlan, error) {
	requestBody := chatCompletionRequest{
		Model:          model,
		Messages:       messages,
		ResponseFormat: responseFormat{Type: "json_object"},
		Temperature:    0.4,
	}
	encoded, err := json.Marshal(requestBody)
	if err != nil {
		return roadmapPlan{}, fmt.Errorf("encode LLM request: %w", err)
	}
	baseURL := strings.TrimRight(h.BaseURL, "/")
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/chat/completions", bytes.NewReader(encoded))
	if err != nil {
		return roadmapPlan{}, fmt.Errorf("create LLM request: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+h.APIKey)
	request.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 28 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return roadmapPlan{}, fmt.Errorf("call LLM API: %w", err)
	}
	defer response.Body.Close()
	responseData, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return roadmapPlan{}, fmt.Errorf("read LLM response: %w", err)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return roadmapPlan{}, fmt.Errorf("LLM API returned status %d: %s", response.StatusCode, string(responseData))
	}

	var completion chatCompletionResponse
	if err := json.Unmarshal(responseData, &completion); err != nil {
		return roadmapPlan{}, fmt.Errorf("decode LLM response: %w", err)
	}
	if len(completion.Choices) == 0 {
		return roadmapPlan{}, errors.New("LLM response has no choices")
	}

	var plan roadmapPlan
	if err := json.Unmarshal([]byte(completion.Choices[0].Message.Content), &plan); err != nil {
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
	if plan.WeeklyHours < 1 || plan.WeeklyHours > 40 || len(plan.Steps) == 0 || len(plan.Steps) > 20 {
		return errors.New("plan has invalid workload or step count")
	}
	for _, step := range plan.Steps {
		if step.ID == "" || step.Phase == "" || step.Title == "" || step.Description == "" ||
			(step.Status != "in_progress" && step.Status != "upcoming") ||
			step.ImpactScore < 0 || step.ImpactScore > 100 || len(step.Tasks) == 0 || len(step.Tasks) > 20 {
			return errors.New("plan contains an invalid step")
		}
		for _, task := range step.Tasks {
			if task.ID == "" || task.Title == "" || task.Duration == "" {
				return errors.New("plan contains an invalid task")
			}
		}
	}
	return nil
}
