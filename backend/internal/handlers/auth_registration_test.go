package handlers

import "testing"

func TestValidWeeklyHours(t *testing.T) {
	tests := []struct {
		hours int
		valid bool
	}{
		{hours: 0, valid: false},
		{hours: 1, valid: true},
		{hours: 40, valid: true},
		{hours: 41, valid: false},
	}

	for _, tt := range tests {
		if got := validWeeklyHours(tt.hours); got != tt.valid {
			t.Errorf("validWeeklyHours(%d) = %t, want %t", tt.hours, got, tt.valid)
		}
	}
}

func TestValidGPA(t *testing.T) {
	tests := []struct {
		gpa   float64
		valid bool
	}{
		{gpa: 0.99, valid: false},
		{gpa: 1, valid: true},
		{gpa: 5, valid: true},
		{gpa: 5.01, valid: false},
	}

	for _, tt := range tests {
		if got := validGPA(tt.gpa); got != tt.valid {
			t.Errorf("validGPA(%g) = %t, want %t", tt.gpa, got, tt.valid)
		}
	}
}
