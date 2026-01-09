package models_test

import (
	"encoding/json"
	"testing"

	"fit-pc/models"
)

func TestVector3_JSON(t *testing.T) {
	v := models.Vector3{X: 1.5, Y: 2.5, Z: 3.5}

	data, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("failed to marshal Vector3: %v", err)
	}

	var decoded models.Vector3
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal Vector3: %v", err)
	}

	if decoded.X != v.X || decoded.Y != v.Y || decoded.Z != v.Z {
		t.Errorf("Vector3 mismatch: got %+v, want %+v", decoded, v)
	}
}

func TestAnchorPoint_JSON(t *testing.T) {
	ap := models.AnchorPoint{
		Name:            "cpu_socket",
		Position:        models.Vector3{X: 0, Y: 1, Z: 0},
		Rotation:        models.Vector3{X: 0, Y: 0, Z: 0},
		CompatibleTypes: []string{"LGA1700", "LGA1200"},
	}

	data, err := json.Marshal(ap)
	if err != nil {
		t.Fatalf("failed to marshal AnchorPoint: %v", err)
	}

	var decoded models.AnchorPoint
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal AnchorPoint: %v", err)
	}

	if decoded.Name != ap.Name {
		t.Errorf("Name mismatch: got %s, want %s", decoded.Name, ap.Name)
	}
	if len(decoded.CompatibleTypes) != len(ap.CompatibleTypes) {
		t.Errorf("CompatibleTypes length mismatch: got %d, want %d", len(decoded.CompatibleTypes), len(ap.CompatibleTypes))
	}
}

func TestAnchorPoints_Value(t *testing.T) {
	tests := []struct {
		name    string
		input   models.AnchorPoints
		wantNil bool
	}{
		{
			name:    "nil anchor points",
			input:   nil,
			wantNil: true,
		},
		{
			name:    "empty anchor points",
			input:   models.AnchorPoints{},
			wantNil: false,
		},
		{
			name: "with anchor points",
			input: models.AnchorPoints{
				{Name: "socket1", Position: models.Vector3{X: 0, Y: 0, Z: 0}},
			},
			wantNil: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			val, err := tt.input.Value()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.wantNil && val != nil {
				t.Errorf("expected nil, got %v", val)
			}
			if !tt.wantNil && val == nil {
				t.Error("expected non-nil value")
			}
		})
	}
}

func TestAnchorPoints_Scan(t *testing.T) {
	tests := []struct {
		name      string
		input     interface{}
		wantErr   bool
		wantCount int
	}{
		{
			name:      "nil value",
			input:     nil,
			wantErr:   false,
			wantCount: 0,
		},
		{
			name:      "valid JSON",
			input:     []byte(`[{"name":"test","position":{"x":0,"y":0,"z":0},"rotation":{"x":0,"y":0,"z":0},"compatible_types":["cpu"]}]`),
			wantErr:   false,
			wantCount: 1,
		},
		{
			name:    "invalid JSON",
			input:   []byte(`invalid`),
			wantErr: true,
		},
		{
			name:    "wrong type",
			input:   "string",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var ap models.AnchorPoints
			err := ap.Scan(tt.input)
			if tt.wantErr && err == nil {
				t.Error("expected error, got nil")
			}
			if !tt.wantErr && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
			if !tt.wantErr && len(ap) != tt.wantCount {
				t.Errorf("count mismatch: got %d, want %d", len(ap), tt.wantCount)
			}
		})
	}
}

func TestTechnicalSpecs_Value(t *testing.T) {
	tests := []struct {
		name    string
		input   models.TechnicalSpecs
		wantNil bool
	}{
		{
			name:    "nil specs",
			input:   nil,
			wantNil: true,
		},
		{
			name:    "empty specs",
			input:   models.TechnicalSpecs{},
			wantNil: false,
		},
		{
			name: "with specs",
			input: models.TechnicalSpecs{
				"socket": "LGA1700",
				"tdp":    125,
			},
			wantNil: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			val, err := tt.input.Value()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.wantNil && val != nil {
				t.Errorf("expected nil, got %v", val)
			}
			if !tt.wantNil && val == nil {
				t.Error("expected non-nil value")
			}
		})
	}
}

func TestTechnicalSpecs_Scan(t *testing.T) {
	tests := []struct {
		name    string
		input   interface{}
		wantErr bool
		wantKey string
	}{
		{
			name:    "nil value",
			input:   nil,
			wantErr: false,
		},
		{
			name:    "valid JSON",
			input:   []byte(`{"socket":"LGA1700","cores":8}`),
			wantErr: false,
			wantKey: "socket",
		},
		{
			name:    "invalid JSON",
			input:   []byte(`{invalid}`),
			wantErr: true,
		},
		{
			name:    "wrong type",
			input:   123,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var ts models.TechnicalSpecs
			err := ts.Scan(tt.input)
			if tt.wantErr && err == nil {
				t.Error("expected error, got nil")
			}
			if !tt.wantErr && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
			if tt.wantKey != "" {
				if _, ok := ts[tt.wantKey]; !ok {
					t.Errorf("expected key %s not found", tt.wantKey)
				}
			}
		})
	}
}

func TestComponentIDs_Value(t *testing.T) {
	tests := []struct {
		name    string
		input   models.ComponentIDs
		wantNil bool
	}{
		{
			name:    "nil IDs",
			input:   nil,
			wantNil: true,
		},
		{
			name:    "empty IDs",
			input:   models.ComponentIDs{},
			wantNil: false,
		},
		{
			name:    "with IDs",
			input:   models.ComponentIDs{1, 2, 3},
			wantNil: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			val, err := tt.input.Value()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.wantNil && val != nil {
				t.Errorf("expected nil, got %v", val)
			}
			if !tt.wantNil && val == nil {
				t.Error("expected non-nil value")
			}
		})
	}
}

func TestComponentIDs_Scan(t *testing.T) {
	tests := []struct {
		name      string
		input     interface{}
		wantErr   bool
		wantCount int
	}{
		{
			name:      "nil value",
			input:     nil,
			wantErr:   false,
			wantCount: 0,
		},
		{
			name:      "valid JSON",
			input:     []byte(`[1,2,3,4,5]`),
			wantErr:   false,
			wantCount: 5,
		},
		{
			name:    "invalid JSON",
			input:   []byte(`[invalid]`),
			wantErr: true,
		},
		{
			name:    "wrong type",
			input:   "string",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var cids models.ComponentIDs
			err := cids.Scan(tt.input)
			if tt.wantErr && err == nil {
				t.Error("expected error, got nil")
			}
			if !tt.wantErr && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
			if !tt.wantErr && len(cids) != tt.wantCount {
				t.Errorf("count mismatch: got %d, want %d", len(cids), tt.wantCount)
			}
		})
	}
}

func TestProduct_TableName(t *testing.T) {
	p := models.Product{}
	if p.TableName() != "products" {
		t.Errorf("expected 'products', got '%s'", p.TableName())
	}
}

func TestBuild_TableName(t *testing.T) {
	b := models.Build{}
	if b.TableName() != "builds" {
		t.Errorf("expected 'builds', got '%s'", b.TableName())
	}
}
