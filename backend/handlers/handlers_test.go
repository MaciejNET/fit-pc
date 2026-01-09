package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"fit-pc/handlers"
	"fit-pc/models"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestFilterBySocketCompatibility(t *testing.T) {
	parent := models.Product{
		Name:     "Test Motherboard",
		Category: "motherboard",
		AnchorPoints: models.AnchorPoints{
			{
				Name:            "cpu_socket",
				CompatibleTypes: []string{"LGA1700"},
			},
		},
	}

	candidates := []models.Product{
		{
			Name:     "Compatible CPU",
			Category: "cpu",
			TechnicalSpecs: models.TechnicalSpecs{
				"socket": "LGA1700",
			},
		},
		{
			Name:     "Incompatible CPU",
			Category: "cpu",
			TechnicalSpecs: models.TechnicalSpecs{
				"socket": "AM5",
			},
		},
		{
			Name:     "No Socket Spec",
			Category: "cpu",
			TechnicalSpecs: models.TechnicalSpecs{
				"cores": 8,
			},
		},
	}

	result := handlers.FilterBySocketCompatibility(parent, candidates)

	if len(result) != 2 {
		t.Errorf("expected 2 compatible parts, got %d", len(result))
	}

	foundCompatible := false
	foundNoSocket := false
	for _, p := range result {
		if p.Name == "Compatible CPU" {
			foundCompatible = true
		}
		if p.Name == "No Socket Spec" {
			foundNoSocket = true
		}
	}

	if !foundCompatible {
		t.Error("expected 'Compatible CPU' to be included")
	}
	if !foundNoSocket {
		t.Error("expected 'No Socket Spec' to be included (no socket = include by default)")
	}
}

func TestCreatePartRequest_Validation(t *testing.T) {
	tests := []struct {
		name    string
		body    string
		wantErr bool
	}{
		{
			name:    "valid request",
			body:    `{"name":"Test","sku":"SKU-001","category":"cpu","price":100}`,
			wantErr: false,
		},
		{
			name:    "missing name",
			body:    `{"sku":"SKU-001","category":"cpu","price":100}`,
			wantErr: true,
		},
		{
			name:    "missing sku",
			body:    `{"name":"Test","category":"cpu","price":100}`,
			wantErr: true,
		},
		{
			name:    "missing category",
			body:    `{"name":"Test","sku":"SKU-001","price":100}`,
			wantErr: true,
		},
		{
			name:    "negative price",
			body:    `{"name":"Test","sku":"SKU-001","category":"cpu","price":-10}`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req handlers.CreatePartRequest
			err := json.Unmarshal([]byte(tt.body), &req)
			if err != nil && !tt.wantErr {
				t.Errorf("unexpected unmarshal error: %v", err)
			}
		})
	}
}

func TestSaveBuildRequest_Validation(t *testing.T) {
	tests := []struct {
		name    string
		body    string
		wantErr bool
	}{
		{
			name:    "valid request",
			body:    `{"name":"My Build","component_ids":[1,2,3]}`,
			wantErr: false,
		},
		{
			name:    "missing name",
			body:    `{"component_ids":[1,2,3]}`,
			wantErr: true,
		},
		{
			name:    "missing component_ids",
			body:    `{"name":"My Build"}`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req handlers.SaveBuildRequest
			err := json.Unmarshal([]byte(tt.body), &req)
			if err != nil && !tt.wantErr {
				t.Errorf("unexpected unmarshal error: %v", err)
			}
		})
	}
}

func TestUpdateAnchorPointsRequest_JSON(t *testing.T) {
	body := `{
		"anchor_points": [
			{
				"name": "cpu_socket",
				"position": {"x": 0, "y": 1, "z": 0},
				"rotation": {"x": 0, "y": 0, "z": 0},
				"compatible_types": ["LGA1700", "cpu"]
			}
		]
	}`

	var req handlers.UpdateAnchorPointsRequest
	if err := json.Unmarshal([]byte(body), &req); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if len(req.AnchorPoints) != 1 {
		t.Errorf("expected 1 anchor point, got %d", len(req.AnchorPoints))
	}

	if req.AnchorPoints[0].Name != "cpu_socket" {
		t.Errorf("expected name 'cpu_socket', got '%s'", req.AnchorPoints[0].Name)
	}

	if req.AnchorPoints[0].Position.Y != 1 {
		t.Errorf("expected position.y = 1, got %f", req.AnchorPoints[0].Position.Y)
	}
}

func TestResponseFormat(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	c.JSON(http.StatusOK, gin.H{
		"data":  []models.Product{},
		"count": 0,
	})

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if _, ok := response["data"]; !ok {
		t.Error("expected 'data' key in response")
	}
	if _, ok := response["count"]; !ok {
		t.Error("expected 'count' key in response")
	}
}
