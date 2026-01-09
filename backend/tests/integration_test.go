package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"fit-pc/db"
	"fit-pc/handlers"
	"fit-pc/middleware"
	"fit-pc/models"

	"github.com/gin-gonic/gin"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
	gormpostgres "gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var testRouter *gin.Engine
var testDB *gorm.DB
var pgContainer testcontainers.Container

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)

	ctx := context.Background()

	container, err := tcpostgres.Run(ctx,
		"postgres:16-alpine",
		tcpostgres.WithDatabase("testdb"),
		tcpostgres.WithUsername("test"),
		tcpostgres.WithPassword("test"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(30*time.Second),
		),
	)
	if err != nil {
		fmt.Printf("Failed to start postgres container: %v\n", err)
		panic(err)
	}
	pgContainer = container

	connStr, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		fmt.Printf("Failed to get connection string: %v\n", err)
		panic(err)
	}

	testDB, err = gorm.Open(gormpostgres.Open(connStr), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		fmt.Printf("Failed to connect to test database: %v\n", err)
		panic(err)
	}

	testDB.AutoMigrate(&models.Product{}, &models.Build{})

	db.DB = testDB

	testRouter = setupRouter()

	code := m.Run()

	cleanupDatabase()

	if err := container.Terminate(ctx); err != nil {
		fmt.Printf("Failed to terminate container: %v\n", err)
	}

	if code != 0 {
		panic(fmt.Sprintf("tests failed with code %d", code))
	}
}

func setupRouter() *gin.Engine {
	r := gin.New()

	api := r.Group("/api")
	{
		parts := api.Group("/parts")
		{
			parts.GET("", handlers.GetParts)
			parts.GET("/:id", handlers.GetPartDetails)
			parts.GET("/:id/compatible", handlers.GetCompatibleParts)
		}

		user := api.Group("/user")
		user.Use(middleware.ClerkAuthMiddleware())
		{
			builds := user.Group("/builds")
			{
				builds.GET("", handlers.GetUserBuilds)
				builds.POST("", handlers.SaveBuild)
				builds.GET("/:id", handlers.GetBuildDetails)
				builds.PUT("/:id", handlers.UpdateBuild)
				builds.DELETE("/:id", handlers.DeleteBuild)
			}
		}

		admin := api.Group("/admin")
		admin.Use(middleware.ClerkAuthMiddleware(), middleware.RequireAdmin())
		{
			adminProducts := admin.Group("/products")
			{
				adminProducts.GET("", handlers.GetAdminProducts)
				adminProducts.POST("", handlers.CreatePart)
				adminProducts.PUT("/:id", handlers.UpdateAdminProduct)
				adminProducts.PATCH("/:id/anchors", handlers.UpdatePartAnchors)
				adminProducts.DELETE("/:id", handlers.DeleteAdminProduct)
			}

			adminParts := admin.Group("/parts")
			{
				adminParts.POST("", handlers.CreatePart)
				adminParts.PUT("/:id", handlers.UpdatePart)
				adminParts.PATCH("/:id/anchors", handlers.UpdatePartAnchors)
				adminParts.DELETE("/:id", handlers.DeletePart)
			}
		}
	}

	return r
}

func cleanupDatabase() {
	testDB.Exec("DELETE FROM builds")
	testDB.Exec("DELETE FROM products")
}

func createTestProduct(t *testing.T) models.Product {
	product := models.Product{
		Name:         "Test CPU",
		SKU:          fmt.Sprintf("TEST-CPU-%d", testDB.NowFunc().UnixNano()),
		Category:     "cpu",
		Price:        299.99,
		ModelURL:     "https://example.com/cpu.glb",
		ThumbnailURL: "https://example.com/cpu.jpg",
		TechnicalSpecs: models.TechnicalSpecs{
			"socket": "LGA1700",
			"cores":  8,
		},
	}
	if err := testDB.Create(&product).Error; err != nil {
		t.Fatalf("failed to create test product: %v", err)
	}
	return product
}

func createTestMotherboard(t *testing.T) models.Product {
	product := models.Product{
		Name:         "Test Motherboard",
		SKU:          fmt.Sprintf("TEST-MB-%d", testDB.NowFunc().UnixNano()),
		Category:     "motherboard",
		Price:        199.99,
		ModelURL:     "https://example.com/mb.glb",
		ThumbnailURL: "https://example.com/mb.jpg",
		TechnicalSpecs: models.TechnicalSpecs{
			"socket":      "LGA1700",
			"form_factor": "ATX",
		},
		AnchorPoints: models.AnchorPoints{
			{
				Name:            "cpu_socket",
				Position:        models.Vector3{X: 0, Y: 1, Z: 0},
				Rotation:        models.Vector3{X: 0, Y: 0, Z: 0},
				CompatibleTypes: []string{"cpu", "LGA1700"},
			},
			{
				Name:            "ram_slot_1",
				Position:        models.Vector3{X: 1, Y: 1, Z: 0},
				Rotation:        models.Vector3{X: 0, Y: 0, Z: 0},
				CompatibleTypes: []string{"ram", "DDR5"},
			},
		},
	}
	if err := testDB.Create(&product).Error; err != nil {
		t.Fatalf("failed to create test motherboard: %v", err)
	}
	return product
}

func TestGetParts(t *testing.T) {
	cleanupDatabase()
	createTestProduct(t)

	req := httptest.NewRequest("GET", "/api/parts", nil)
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	data, ok := response["data"].([]interface{})
	if !ok {
		t.Fatal("expected data array in response")
	}

	if len(data) == 0 {
		t.Error("expected at least one product")
	}
}

func TestGetParts_FilterByCategory(t *testing.T) {
	cleanupDatabase()
	createTestProduct(t)
	createTestMotherboard(t)

	req := httptest.NewRequest("GET", "/api/parts?category=cpu", nil)
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	data := response["data"].([]interface{})
	for _, item := range data {
		product := item.(map[string]interface{})
		if product["category"] != "cpu" {
			t.Errorf("expected category 'cpu', got '%s'", product["category"])
		}
	}
}

func TestGetPartDetails(t *testing.T) {
	cleanupDatabase()
	product := createTestProduct(t)

	req := httptest.NewRequest("GET", fmt.Sprintf("/api/parts/%d", product.ID), nil)
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	data := response["data"].(map[string]interface{})
	if data["name"] != product.Name {
		t.Errorf("expected name '%s', got '%s'", product.Name, data["name"])
	}
}

func TestGetPartDetails_NotFound(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/parts/999999", nil)
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status %d, got %d", http.StatusNotFound, w.Code)
	}
}

func TestGetPartDetails_InvalidID(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/parts/invalid", nil)
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestGetCompatibleParts(t *testing.T) {
	cleanupDatabase()
	motherboard := createTestMotherboard(t)
	cpu := createTestProduct(t)
	_ = cpu

	req := httptest.NewRequest("GET", fmt.Sprintf("/api/parts/%d/compatible", motherboard.ID), nil)
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	if _, ok := response["anchor_compatibility"]; !ok {
		t.Error("expected anchor_compatibility in response")
	}
}

func TestCreatePart_Admin(t *testing.T) {
	cleanupDatabase()

	body := map[string]interface{}{
		"name":     "New GPU",
		"sku":      "GPU-001",
		"category": "gpu",
		"price":    499.99,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest("POST", "/api/admin/parts", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(middleware.HeaderClerkUserID, "admin")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected status %d, got %d: %s", http.StatusCreated, w.Code, w.Body.String())
	}
}

func TestCreatePart_NonAdmin(t *testing.T) {
	body := map[string]interface{}{
		"name":     "New GPU",
		"sku":      "GPU-002",
		"category": "gpu",
		"price":    499.99,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest("POST", "/api/admin/parts", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(middleware.HeaderClerkUserID, "regular-user")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected status %d, got %d", http.StatusForbidden, w.Code)
	}
}

func TestUpdatePartAnchors_Admin(t *testing.T) {
	cleanupDatabase()
	product := createTestProduct(t)

	body := map[string]interface{}{
		"anchor_points": []map[string]interface{}{
			{
				"name": "new_anchor",
				"position": map[string]float64{
					"x": 1, "y": 2, "z": 3,
				},
				"rotation": map[string]float64{
					"x": 0, "y": 0, "z": 0,
				},
				"compatible_types": []string{"test"},
			},
		},
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest("PATCH", fmt.Sprintf("/api/admin/parts/%d/anchors", product.ID), bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(middleware.HeaderClerkUserID, "admin")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d: %s", http.StatusOK, w.Code, w.Body.String())
	}
}

func TestSaveBuild(t *testing.T) {
	cleanupDatabase()
	product := createTestProduct(t)

	body := map[string]interface{}{
		"name":          "My Gaming PC",
		"component_ids": []int64{int64(product.ID)},
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest("POST", "/api/user/builds", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(middleware.HeaderClerkUserID, "test-user")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("expected status %d, got %d: %s", http.StatusCreated, w.Code, w.Body.String())
	}
}

func TestSaveBuild_InvalidComponentIDs(t *testing.T) {
	cleanupDatabase()

	body := map[string]interface{}{
		"name": "Invalid Build",
		"components": []map[string]interface{}{
			{"id": 999999, "name": "Invalid", "category": "Unknown", "price": 0},
		},
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest("POST", "/api/user/builds", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(middleware.HeaderClerkUserID, "test-user")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestGetUserBuilds(t *testing.T) {
	cleanupDatabase()

	build := models.Build{
		UserID:     "test-user",
		Name:       "Test Build",
		Components: models.BuildComponents{},
	}
	testDB.Create(&build)

	req := httptest.NewRequest("GET", "/api/user/builds", nil)
	req.Header.Set(middleware.HeaderClerkUserID, "test-user")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	data := response["data"].([]interface{})
	if len(data) == 0 {
		t.Error("expected at least one build")
	}
}

func TestGetUserBuilds_IsolatedByUser(t *testing.T) {
	cleanupDatabase()

	testDB.Create(&models.Build{
		UserID:     "user-a",
		Name:       "User A Build",
		Components: models.BuildComponents{},
	})
	testDB.Create(&models.Build{
		UserID:     "user-b",
		Name:       "User B Build",
		Components: models.BuildComponents{},
	})

	req := httptest.NewRequest("GET", "/api/user/builds", nil)
	req.Header.Set(middleware.HeaderClerkUserID, "user-a")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	count := response["count"].(float64)
	if count != 1 {
		t.Errorf("expected 1 build for user-a, got %v", count)
	}
}

func TestGetBuildDetails(t *testing.T) {
	cleanupDatabase()
	product := createTestProduct(t)

	build := models.Build{
		UserID: "test-user",
		Name:   "Detailed Build",
		Components: models.BuildComponents{
			{
				ID:             uint(product.ID),
				Name:           product.Name,
				Category:       product.Category,
				Price:          product.Price,
				ModelURL:       product.ModelURL,
				TechnicalSpecs: product.TechnicalSpecs,
				AnchorPoints:   product.AnchorPoints,
			},
		},
	}
	testDB.Create(&build)

	req := httptest.NewRequest("GET", fmt.Sprintf("/api/user/builds/%d", build.ID), nil)
	req.Header.Set(middleware.HeaderClerkUserID, "test-user")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	data := response["data"].(map[string]interface{})
	if _, ok := data["components"]; !ok {
		t.Error("expected components in response")
	}
	if _, ok := data["total_price"]; !ok {
		t.Error("expected total_price in response")
	}
}

func TestGetBuildDetails_NotOwner(t *testing.T) {
	cleanupDatabase()

	build := models.Build{
		UserID:     "other-user",
		Name:       "Other User Build",
		Components: models.BuildComponents{},
	}
	testDB.Create(&build)

	req := httptest.NewRequest("GET", fmt.Sprintf("/api/user/builds/%d", build.ID), nil)
	req.Header.Set(middleware.HeaderClerkUserID, "test-user")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status %d, got %d", http.StatusNotFound, w.Code)
	}
}

func TestUpdateBuild(t *testing.T) {
	cleanupDatabase()

	build := models.Build{
		UserID:     "test-user",
		Name:       "Original Name",
		Components: models.BuildComponents{},
	}
	testDB.Create(&build)

	body := map[string]interface{}{
		"name": "Updated Name",
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest("PUT", fmt.Sprintf("/api/user/builds/%d", build.ID), bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(middleware.HeaderClerkUserID, "test-user")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var updated models.Build
	testDB.First(&updated, build.ID)
	if updated.Name != "Updated Name" {
		t.Errorf("expected name 'Updated Name', got '%s'", updated.Name)
	}
}

func TestDeleteBuild(t *testing.T) {
	cleanupDatabase()

	build := models.Build{
		UserID:     "test-user",
		Name:       "To Delete",
		Components: models.BuildComponents{},
	}
	testDB.Create(&build)

	req := httptest.NewRequest("DELETE", fmt.Sprintf("/api/user/builds/%d", build.ID), nil)
	req.Header.Set(middleware.HeaderClerkUserID, "test-user")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var count int64
	testDB.Model(&models.Build{}).Where("id = ?", build.ID).Count(&count)
	if count != 0 {
		t.Error("expected build to be deleted")
	}
}

func TestDeleteBuild_NotOwner(t *testing.T) {
	cleanupDatabase()

	build := models.Build{
		UserID:     "other-user",
		Name:       "Other Build",
		Components: models.BuildComponents{},
	}
	testDB.Create(&build)

	req := httptest.NewRequest("DELETE", fmt.Sprintf("/api/user/builds/%d", build.ID), nil)
	req.Header.Set(middleware.HeaderClerkUserID, "test-user")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status %d, got %d", http.StatusNotFound, w.Code)
	}
}

func TestDeletePart_Admin(t *testing.T) {
	cleanupDatabase()
	product := createTestProduct(t)

	req := httptest.NewRequest("DELETE", fmt.Sprintf("/api/admin/parts/%d", product.ID), nil)
	req.Header.Set(middleware.HeaderClerkUserID, "admin")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}
}

func TestGetAdminProducts_Pagination(t *testing.T) {
	cleanupDatabase()

	for i := 0; i < 25; i++ {
		testDB.Create(&models.Product{
			Name:     fmt.Sprintf("Product %d", i),
			SKU:      fmt.Sprintf("SKU-%d-%d", i, testDB.NowFunc().UnixNano()),
			Category: "cpu",
			Price:    float64(100 + i),
		})
	}

	req := httptest.NewRequest("GET", "/api/admin/products?page=1&limit=10", nil)
	req.Header.Set(middleware.HeaderClerkUserID, "admin")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	data := response["data"].([]interface{})
	if len(data) != 10 {
		t.Errorf("expected 10 products, got %d", len(data))
	}

	meta := response["meta"].(map[string]interface{})
	if int(meta["total"].(float64)) != 25 {
		t.Errorf("expected total 25, got %v", meta["total"])
	}
	if int(meta["page"].(float64)) != 1 {
		t.Errorf("expected page 1, got %v", meta["page"])
	}
	if int(meta["last_page"].(float64)) != 3 {
		t.Errorf("expected last_page 3, got %v", meta["last_page"])
	}
}

func TestGetAdminProducts_Search(t *testing.T) {
	cleanupDatabase()

	testDB.Create(&models.Product{Name: "Intel Core i9", SKU: "CPU-INTEL-001", Category: "cpu", Price: 599.99})
	testDB.Create(&models.Product{Name: "AMD Ryzen 9", SKU: "CPU-AMD-001", Category: "cpu", Price: 549.99})
	testDB.Create(&models.Product{Name: "NVIDIA RTX 4090", SKU: "GPU-NVIDIA-001", Category: "gpu", Price: 1599.99})

	req := httptest.NewRequest("GET", "/api/admin/products?search=intel", nil)
	req.Header.Set(middleware.HeaderClerkUserID, "admin")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	data := response["data"].([]interface{})
	if len(data) != 1 {
		t.Errorf("expected 1 product matching 'intel', got %d", len(data))
	}
}

func TestGetAdminProducts_FilterByCategory(t *testing.T) {
	cleanupDatabase()

	testDB.Create(&models.Product{Name: "CPU 1", SKU: "CPU-001", Category: "cpu", Price: 299.99})
	testDB.Create(&models.Product{Name: "GPU 1", SKU: "GPU-001", Category: "gpu", Price: 499.99})
	testDB.Create(&models.Product{Name: "CPU 2", SKU: "CPU-002", Category: "cpu", Price: 399.99})

	req := httptest.NewRequest("GET", "/api/admin/products?category=gpu", nil)
	req.Header.Set(middleware.HeaderClerkUserID, "admin")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	data := response["data"].([]interface{})
	if len(data) != 1 {
		t.Errorf("expected 1 GPU, got %d", len(data))
	}

	meta := response["meta"].(map[string]interface{})
	if int(meta["total"].(float64)) != 1 {
		t.Errorf("expected total 1, got %v", meta["total"])
	}
}

func TestGetAdminProducts_NonAdmin(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/admin/products", nil)
	req.Header.Set(middleware.HeaderClerkUserID, "regular-user")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected status %d, got %d", http.StatusForbidden, w.Code)
	}
}

func TestUpdateAdminProduct(t *testing.T) {
	cleanupDatabase()
	product := createTestProduct(t)

	body := map[string]interface{}{
		"name":  "Updated CPU Name",
		"price": 399.99,
		"technical_specs": map[string]interface{}{
			"socket": "LGA1700",
			"cores":  16,
			"tdp":    125,
		},
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest("PUT", fmt.Sprintf("/api/admin/products/%d", product.ID), bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(middleware.HeaderClerkUserID, "admin")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var updated models.Product
	testDB.First(&updated, product.ID)

	if updated.Name != "Updated CPU Name" {
		t.Errorf("expected name 'Updated CPU Name', got '%s'", updated.Name)
	}
	if updated.Price != 399.99 {
		t.Errorf("expected price 399.99, got %f", updated.Price)
	}
	if updated.TechnicalSpecs["cores"].(float64) != 16 {
		t.Errorf("expected cores 16, got %v", updated.TechnicalSpecs["cores"])
	}
}

func TestUpdateAdminProduct_ZeroPrice(t *testing.T) {
	cleanupDatabase()
	product := createTestProduct(t)

	zeroPrice := 0.0
	body := map[string]interface{}{
		"price": zeroPrice,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest("PUT", fmt.Sprintf("/api/admin/products/%d", product.ID), bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(middleware.HeaderClerkUserID, "admin")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var updated models.Product
	testDB.First(&updated, product.ID)

	if updated.Price != 0.0 {
		t.Errorf("expected price 0.0, got %f", updated.Price)
	}
}

func TestUpdateAdminProduct_EmptyString(t *testing.T) {
	cleanupDatabase()
	product := createTestProduct(t)

	emptyURL := ""
	body := map[string]interface{}{
		"model_url": emptyURL,
	}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest("PUT", fmt.Sprintf("/api/admin/products/%d", product.ID), bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(middleware.HeaderClerkUserID, "admin")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var updated models.Product
	testDB.First(&updated, product.ID)

	if updated.ModelURL != "" {
		t.Errorf("expected model_url '', got '%s'", updated.ModelURL)
	}
}

func TestUpdateAdminProduct_NotFound(t *testing.T) {
	cleanupDatabase()

	body := map[string]interface{}{"name": "Test"}
	jsonBody, _ := json.Marshal(body)

	req := httptest.NewRequest("PUT", "/api/admin/products/999999", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(middleware.HeaderClerkUserID, "admin")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status %d, got %d", http.StatusNotFound, w.Code)
	}
}

func TestDeleteAdminProduct_SoftDelete(t *testing.T) {
	cleanupDatabase()
	product := createTestProduct(t)
	productID := product.ID

	req := httptest.NewRequest("DELETE", fmt.Sprintf("/api/admin/products/%d", productID), nil)
	req.Header.Set(middleware.HeaderClerkUserID, "admin")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, w.Code)
	}

	var count int64
	testDB.Model(&models.Product{}).Where("id = ?", productID).Count(&count)
	if count != 0 {
		t.Error("expected product to be soft deleted (not visible in normal query)")
	}

	var deletedProduct models.Product
	testDB.Unscoped().First(&deletedProduct, productID)
	if deletedProduct.ID == 0 {
		t.Error("expected product to still exist with Unscoped")
	}
	if deletedProduct.DeletedAt.Time.IsZero() {
		t.Error("expected DeletedAt to be set")
	}
}

func TestDeleteAdminProduct_NotFound(t *testing.T) {
	cleanupDatabase()

	req := httptest.NewRequest("DELETE", "/api/admin/products/999999", nil)
	req.Header.Set(middleware.HeaderClerkUserID, "admin")
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status %d, got %d", http.StatusNotFound, w.Code)
	}
}
