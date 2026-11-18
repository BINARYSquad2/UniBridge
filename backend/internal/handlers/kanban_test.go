package handlers

import (
	"encoding/json"
	"testing"
)

func TestUpdateKanbanTaskRequestAcceptsDescription(t *testing.T) {
	var request updateKanbanTaskRequest
	if err := json.Unmarshal([]byte(`{
		"status":"done",
		"micro_steps":[{"id":"step-1","title":"Complete work","completed":true}],
		"description":"Implemented and verified the feature."
	}`), &request); err != nil {
		t.Fatalf("decode update request: %v", err)
	}

	if request.Description == nil || *request.Description != "Implemented and verified the feature." {
		t.Fatalf("description = %v, want the supplied description", request.Description)
	}
	if request.Status != "done" || request.MicroSteps == nil || len(*request.MicroSteps) != 1 || !(*request.MicroSteps)[0].Completed {
		t.Fatalf("completion data was not decoded: %+v", request)
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
