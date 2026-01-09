package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/jwt"
	"github.com/gin-gonic/gin"
)

var clerkEnabled bool

const (
	ContextKeyUserID   = "userID"
	ContextKeyUserRole = "userRole"
	ContextKeyOrgID    = "orgID"
	ContextKeyOrgRole  = "orgRole"

	HeaderClerkUserID    = "X-Clerk-User-ID"
	HeaderClerkSessionID = "X-Clerk-Session-ID"
	HeaderAuthorization  = "Authorization"

	RoleOrgAdmin  = "org:admin"
	RoleOrgMember = "org:member"
)

func InitClerk(secretKey string) {
	if secretKey == "" {
		clerkEnabled = false
		return
	}
	clerk.SetKey(secretKey)
	clerkEnabled = true
}

func IsClerkEnabled() bool {
	return clerkEnabled
}

func ClerkAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		var userID string
		var role string

		// If Clerk is enabled, verify the JWT token
		if clerkEnabled {
			userID, role = verifyClerkToken(c)
			if userID == "" {
				// Check if we should allow fallback to dev mode
				if os.Getenv("ALLOW_DEV_AUTH") == "true" {
					userID, role = getDevModeAuth(c)
				}
			}
		} else {
			// Clerk not configured - use development mode
			userID, role = getDevModeAuth(c)
		}

		if userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Authorization required",
			})
			return
		}

		// Store user ID and role in context for handlers to access
		c.Set(ContextKeyUserID, userID)
		c.Set(ContextKeyUserRole, role)

		c.Next()
	}
}

// verifyClerkToken verifies the JWT token with Clerk and extracts org role
func verifyClerkToken(c *gin.Context) (string, string) {
	authHeader := c.GetHeader(HeaderAuthorization)
	if authHeader == "" {
		return "", ""
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return "", ""
	}

	token := parts[1]

	claims, err := jwt.Verify(c.Request.Context(), &jwt.VerifyParams{
		Token: token,
	})
	if err != nil {
		return "", ""
	}

	userID := claims.Subject
	role := RoleOrgMember

	if claims.ActiveOrganizationRole != "" {
		role = claims.ActiveOrganizationRole
	}

	if claims.ActiveOrganizationID != "" {
		c.Set(ContextKeyOrgID, claims.ActiveOrganizationID)
	}

	return userID, role
}

// getDevModeAuth extracts auth info from headers for development mode
func getDevModeAuth(c *gin.Context) (string, string) {
	// Try to get user ID from custom header (development mode)
	userID := c.GetHeader(HeaderClerkUserID)

	// If not in custom header, try to extract from Authorization header
	if userID == "" {
		authHeader := c.GetHeader(HeaderAuthorization)
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
				userID = parts[1]
			}
		}
	}

	// Fallback to test user for development
	if userID == "" {
		userID = "test-user-001"
	}

	role := getUserRole(userID)
	return userID, role
}

// RequireAdmin middleware ensures the user has org:admin role
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get(ContextKeyUserRole)
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Authentication required",
			})
			return
		}

		if role != RoleOrgAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "Admin access required (org:admin role needed)",
			})
			return
		}

		c.Next()
	}
}

// getUserRole returns the role for a user in development mode
func getUserRole(userID string) string {
	adminUsers := map[string]bool{
		"admin-user-001": true,
		"admin":          true,
	}

	if adminUsers[userID] {
		return RoleOrgAdmin
	}
	return RoleOrgMember
}

// GetUserIDFromContext extracts user ID from Gin context
func GetUserIDFromContext(c *gin.Context) (string, bool) {
	userID, exists := c.Get(ContextKeyUserID)
	if !exists {
		return "", false
	}
	return userID.(string), true
}

// GetUserRoleFromContext extracts user role from Gin context
func GetUserRoleFromContext(c *gin.Context) (string, bool) {
	role, exists := c.Get(ContextKeyUserRole)
	if !exists {
		return "", false
	}
	return role.(string), true
}
