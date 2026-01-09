package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"fit-pc/middleware"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestGetUserIDFromContext(t *testing.T) {
	tests := []struct {
		name      string
		setupCtx  func(*gin.Context)
		wantID    string
		wantExist bool
	}{
		{
			name:      "no user ID in context",
			setupCtx:  func(c *gin.Context) {},
			wantID:    "",
			wantExist: false,
		},
		{
			name: "user ID exists",
			setupCtx: func(c *gin.Context) {
				c.Set(middleware.ContextKeyUserID, "user-123")
			},
			wantID:    "user-123",
			wantExist: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			tt.setupCtx(c)

			id, exists := middleware.GetUserIDFromContext(c)
			if exists != tt.wantExist {
				t.Errorf("exists = %v, want %v", exists, tt.wantExist)
			}
			if id != tt.wantID {
				t.Errorf("id = %s, want %s", id, tt.wantID)
			}
		})
	}
}

func TestGetUserRoleFromContext(t *testing.T) {
	tests := []struct {
		name      string
		setupCtx  func(*gin.Context)
		wantRole  string
		wantExist bool
	}{
		{
			name:      "no role in context",
			setupCtx:  func(c *gin.Context) {},
			wantRole:  "",
			wantExist: false,
		},
		{
			name: "role exists",
			setupCtx: func(c *gin.Context) {
				c.Set(middleware.ContextKeyUserRole, middleware.RoleOrgAdmin)
			},
			wantRole:  middleware.RoleOrgAdmin,
			wantExist: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			tt.setupCtx(c)

			role, exists := middleware.GetUserRoleFromContext(c)
			if exists != tt.wantExist {
				t.Errorf("exists = %v, want %v", exists, tt.wantExist)
			}
			if role != tt.wantRole {
				t.Errorf("role = %s, want %s", role, tt.wantRole)
			}
		})
	}
}

func TestRequireAdmin(t *testing.T) {
	tests := []struct {
		name       string
		setupCtx   func(*gin.Context)
		wantStatus int
		wantAbort  bool
	}{
		{
			name:       "no role - unauthorized",
			setupCtx:   func(c *gin.Context) {},
			wantStatus: http.StatusUnauthorized,
			wantAbort:  true,
		},
		{
			name: "org:member role - forbidden",
			setupCtx: func(c *gin.Context) {
				c.Set(middleware.ContextKeyUserRole, middleware.RoleOrgMember)
			},
			wantStatus: http.StatusForbidden,
			wantAbort:  true,
		},
		{
			name: "org:admin role - allowed",
			setupCtx: func(c *gin.Context) {
				c.Set(middleware.ContextKeyUserRole, middleware.RoleOrgAdmin)
			},
			wantStatus: http.StatusOK,
			wantAbort:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/", nil)
			tt.setupCtx(c)

			handler := middleware.RequireAdmin()
			handler(c)

			if tt.wantAbort {
				if !c.IsAborted() {
					t.Error("expected request to be aborted")
				}
				if w.Code != tt.wantStatus {
					t.Errorf("status = %d, want %d", w.Code, tt.wantStatus)
				}
			} else {
				if c.IsAborted() {
					t.Error("expected request not to be aborted")
				}
			}
		})
	}
}

func TestClerkAuthMiddleware_DevMode(t *testing.T) {
	tests := []struct {
		name       string
		headers    map[string]string
		wantUserID string
		wantAbort  bool
	}{
		{
			name:       "no auth header - uses test user",
			headers:    map[string]string{},
			wantUserID: "test-user-001",
			wantAbort:  false,
		},
		{
			name: "X-Clerk-User-ID header",
			headers: map[string]string{
				middleware.HeaderClerkUserID: "custom-user-123",
			},
			wantUserID: "custom-user-123",
			wantAbort:  false,
		},
		{
			name: "Bearer token as user ID in dev mode",
			headers: map[string]string{
				middleware.HeaderAuthorization: "Bearer dev-user-456",
			},
			wantUserID: "dev-user-456",
			wantAbort:  false,
		},
		{
			name: "admin user gets admin role",
			headers: map[string]string{
				middleware.HeaderClerkUserID: "admin",
			},
			wantUserID: "admin",
			wantAbort:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/", nil)

			for k, v := range tt.headers {
				c.Request.Header.Set(k, v)
			}

			var capturedUserID string
			router := gin.New()
			router.Use(middleware.ClerkAuthMiddleware())
			router.GET("/", func(c *gin.Context) {
				capturedUserID, _ = middleware.GetUserIDFromContext(c)
				c.Status(http.StatusOK)
			})

			router.ServeHTTP(w, c.Request)

			if tt.wantAbort {
				if w.Code != http.StatusUnauthorized {
					t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
				}
			} else {
				if capturedUserID != tt.wantUserID {
					t.Errorf("userID = %s, want %s", capturedUserID, tt.wantUserID)
				}
			}
		})
	}
}

func TestAdminUserRole(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Request.Header.Set(middleware.HeaderClerkUserID, "admin")

	var capturedRole string
	router := gin.New()
	router.Use(middleware.ClerkAuthMiddleware())
	router.GET("/", func(c *gin.Context) {
		capturedRole, _ = middleware.GetUserRoleFromContext(c)
		c.Status(http.StatusOK)
	})

	router.ServeHTTP(w, c.Request)

	if capturedRole != middleware.RoleOrgAdmin {
		t.Errorf("role = %s, want %s", capturedRole, middleware.RoleOrgAdmin)
	}
}
