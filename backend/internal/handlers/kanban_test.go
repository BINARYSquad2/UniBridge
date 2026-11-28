package handlers

import (
	"encoding/json"
	"testing"
)

func TestUpdateKanbanTaskRequestAcceptsDescription(t *testing.T) {
	var request updateKanbanTaskRequest
	if err := json.Unmarshal([]byte(`{
		"track":"leadership",
		"status":"done",
		"micro_steps":[{"id":"step-1","title":"Complete work","completed":true}],
		"description":"Implemented and verified the feature."
	}`), &request); err != nil {
		t.Fatalf("decode update request: %v", err)
	}

	if request.Description == nil || *request.Description != "Implemented and verified the feature." {
		t.Fatalf("description = %v, want the supplied description", request.Description)
	}
	if request.Track != "leadership" {
		t.Fatalf("track = %q, want leadership", request.Track)
	}
	if request.Status != "done" || request.MicroSteps == nil || len(*request.MicroSteps) != 1 || !(*request.MicroSteps)[0].Completed {
		t.Fatalf("completion data was not decoded: %+v", request)
	}
}

func TestCreateKanbanTaskRequestDecodesStatus(t *testing.T) {
	var request createKanbanTaskRequest
	if err := json.Unmarshal([]byte(`{
		"track":"impact",
		"title":"Finish roadmap",
		"task_type":"academic",
		"status":"in_progress",
		"micro_steps":[{"id":"step-1","title":"Complete work","status":"todo","completed":false}]
	}`), &request); err != nil {
		t.Fatalf("decode create request: %v", err)
	}

	if request.Status != "in_progress" {
		t.Fatalf("status = %q, want in_progress", request.Status)
	}
	if request.Track != "impact" {
		t.Fatalf("track = %q, want impact", request.Track)
	}
	if len(request.MicroSteps) != 1 || request.MicroSteps[0].Status != "todo" {
		t.Fatalf("micro-step status was not decoded: %+v", request.MicroSteps)
	}
}

func TestValidRoadmapTrack(t *testing.T) {
	for _, test := range []struct {
		track string
		valid bool
	}{
		{track: "academics", valid: true},
		{track: "leadership", valid: true},
		{track: "impact", valid: true},
		{track: "other"},
		{track: ""},
	} {
		if got := validRoadmapTrack(test.track); got != test.valid {
			t.Errorf("validRoadmapTrack(%q) = %t, want %t", test.track, got, test.valid)
		}
	}
}

func TestValidateKanbanTaskArtifact(t *testing.T) {
	tests := []struct {
		name     string
		artifact kanbanTaskArtifact
		wantErr  bool
	}{
		{name: "https link", artifact: kanbanTaskArtifact{Type: "link", Value: "https://example.com/result"}},
		{name: "http link", artifact: kanbanTaskArtifact{Type: "link", Value: "http://example.com/result"}},
		{name: "unsupported link scheme", artifact: kanbanTaskArtifact{Type: "link", Value: "javascript:alert(1)"}, wantErr: true},
		{name: "missing link host", artifact: kanbanTaskArtifact{Type: "link", Value: "https:///result"}, wantErr: true},
		{name: "reflection", artifact: kanbanTaskArtifact{Type: "explanation", Value: "Completed the implementation."}},
		{name: "short reflection", artifact: kanbanTaskArtifact{Type: "explanation", Value: "done"}, wantErr: true},
		{name: "unknown type", artifact: kanbanTaskArtifact{Type: "file", Value: "result"}, wantErr: true},
		{name: "empty value", artifact: kanbanTaskArtifact{Type: "explanation"}, wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateKanbanTaskArtifact(test.artifact)
			if (err != nil) != test.wantErr {
				t.Fatalf("validateKanbanTaskArtifact() error = %v, wantErr %v", err, test.wantErr)
			}
		})
	}
}

func TestValidateKanbanMicroStepsStatus(t *testing.T) {
	tests := []struct {
		name      string
		status    string
		wantError bool
	}{
		{name: "empty status remains backward compatible", status: ""},
		{name: "todo", status: "todo"},
		{name: "in progress", status: "in_progress"},
		{name: "done", status: "done"},
		{name: "invalid status", status: "pending", wantError: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateKanbanMicroSteps([]kanbanMicroStep{{
				ID:        "step-1",
				Title:     "Complete work",
				Status:    test.status,
				Completed: false,
			}})
			if (err != nil) != test.wantError {
				t.Fatalf("validateKanbanMicroSteps() error = %v, wantError %v", err, test.wantError)
			}
		})
	}
}
