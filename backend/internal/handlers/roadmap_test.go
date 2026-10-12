package handlers

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

type recordingGeminiGenerator struct {
	models  []string
	prompts []string
}

func (g *recordingGeminiGenerator) Generate(_ context.Context, model, prompt string) (string, error) {
	g.models = append(g.models, model)
	g.prompts = append(g.prompts, prompt)
	estimatedMinutes := 120
	plan := roadmapPlan{
		Title:             "Учебный план",
		Summary:           "План подготовки",
		StartGrade:        9,
		EndGrade:          11,
		StartAcademicYear: "2026-2027",
		EndAcademicYear:   "2028-2029",
		WeeklyHours:       8,
		Steps: []roadmapStep{{
			ID: "step-1", Phase: "9 класс", Title: "Фундамент", Description: "Основы",
			Status: "in_progress", EstimatedTime: "2026-2027", ImpactScore: 70,
			Tasks: []roadmapTask{{ID: "task-1", Title: "Выбрать направление", Duration: "2 часа", TaskType: "academic", EstimatedMinutes: &estimatedMinutes}},
		}},
	}
	if model == "first-model" {
		plan.EndGrade = 10
	}
	encoded, err := json.Marshal(plan)
	return string(encoded), err
}

func TestAcademicYearRange(t *testing.T) {
	tests := []struct {
		name       string
		date       time.Time
		grade      int
		start, end int
	}{
		{"fall term", time.Date(2026, time.October, 7, 0, 0, 0, 0, time.UTC), 9, 2026, 2028},
		{"spring term", time.Date(2027, time.March, 1, 0, 0, 0, 0, time.UTC), 10, 2026, 2027},
		{"final school year", time.Date(2026, time.November, 1, 0, 0, 0, 0, time.UTC), 11, 2026, 2026},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			start, end := academicYearRange(test.date, test.grade)
			if start != test.start || end != test.end {
				t.Fatalf("academicYearRange() = (%d, %d), want (%d, %d)", start, end, test.start, test.end)
			}
		})
	}
}

func TestValidateRoadmapPlanRequiresRequestedGradeRange(t *testing.T) {
	estimatedMinutes := 120
	plan := roadmapPlan{
		Title:             "Учебный план",
		Summary:           "Подготовка по выбранным направлениям",
		StartGrade:        9,
		EndGrade:          11,
		StartAcademicYear: "2026-2027",
		EndAcademicYear:   "2028-2029",
		WeeklyHours:       8,
		Steps: []roadmapStep{{
			ID: "step-1", Phase: "9 класс", Title: "Фундамент", Description: "Основы",
			Status: "in_progress", EstimatedTime: "2026-2027", ImpactScore: 70,
			Tasks: []roadmapTask{{ID: "task-1", Title: "Выбрать направление", Duration: "2 часа", TaskType: "academic", EstimatedMinutes: &estimatedMinutes}},
		}},
	}

	if err := validateRoadmapPlan(plan, 9, 2026, 2028); err != nil {
		t.Fatalf("valid plan rejected: %v", err)
	}

	plan.EndGrade = 10
	if err := validateRoadmapPlan(plan, 9, 2026, 2028); err == nil {
		t.Fatal("plan ending before grade 11 was accepted")
	}
}

func TestModelCandidatesParsesAndLimitsCommaSeparatedModels(t *testing.T) {
	handler := Roadmap{Model: " model-a, model-b, model-a,,model-c,model-d,model-e "}
	got := handler.modelCandidates()
	want := []string{"model-a", "model-b", "model-c", "model-d"}
	if len(got) != len(want) {
		t.Fatalf("modelCandidates() = %v, want %v", got, want)
	}
	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("modelCandidates() = %v, want %v", got, want)
		}
	}
}

func TestGeneratePlanFallsBackWhenFirstModelReturnsInvalidGradeRange(t *testing.T) {
	generator := &recordingGeminiGenerator{}
	handler := Roadmap{
		Model:     "first-model, second-model",
		generator: generator,
	}
	profile := roadmapProfile{SchoolGrade: 9}

	plan, err := handler.generatePlan(context.Background(), profile, "", 2026, 2028)
	if err != nil {
		t.Fatalf("generatePlan() returned error: %v", err)
	}
	if plan.EndGrade != 11 {
		t.Fatalf("generatePlan() returned end grade %d, want 11", plan.EndGrade)
	}
	if len(generator.models) != 2 || generator.models[0] != "first-model" || generator.models[1] != "second-model" {
		t.Fatalf("requested models = %v, want [first-model second-model]", generator.models)
	}
}

func TestGeneratePlanIncludesPreferencesInPrompt(t *testing.T) {
	generator := &recordingGeminiGenerator{}
	handler := Roadmap{Model: "test-model", generator: generator}
	profile := roadmapProfile{SchoolGrade: 9}
	preferences := "Хочу заниматься робототехникой"

	if _, err := handler.generatePlan(context.Background(), profile, preferences, 2026, 2028); err != nil {
		t.Fatalf("generatePlan() returned error: %v", err)
	}
	if len(generator.prompts) != 1 || !strings.Contains(generator.prompts[0], preferences) {
		t.Fatalf("generated prompt %q does not include preferences %q", generator.prompts, preferences)
	}
}
