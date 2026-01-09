package main

import (
	"log"

	"fit-pc/db"
	"fit-pc/handlers"
	"fit-pc/internal/config"
	"fit-pc/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	cfg := config.LoadConfig()
	log.Println("Configuration loaded successfully")

	// Initialize Clerk authentication
	middleware.InitClerk(cfg.ClerkSecretKey)

	// Initialize database
	if err := db.Init(cfg.DBConnectionString); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Setup Gin router
	router := gin.Default()

	// Configure CORS
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Clerk-User-ID", "X-Clerk-Session-ID"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "pc-builder-3d-api",
		})
	})

	// API routes
	api := router.Group("/api")
	{
		// ===================
		// PUBLIC ROUTES
		// ===================
		// Parts/Products endpoints (public read access)
		parts := api.Group("/parts")
		{
			parts.GET("", handlers.GetParts)                          // GET /api/parts?category=...
			parts.GET("/:id", handlers.GetPartDetails)                // GET /api/parts/:id
			parts.GET("/:id/compatible", handlers.GetCompatibleParts) // GET /api/parts/:id/compatible
		}

		// Public storage endpoints (read-only access to models)
		api.GET("/download-token", handlers.GenerateDownloadToken) // GET /api/download-token?blob=...

		// ===================
		// PROTECTED USER ROUTES
		// ===================
		user := api.Group("/user")
		user.Use(middleware.ClerkAuthMiddleware())
		{
			// Builds endpoints
			builds := user.Group("/builds")
			{
				builds.GET("", handlers.GetUserBuilds)       // GET /api/user/builds
				builds.POST("", handlers.SaveBuild)          // POST /api/user/builds
				builds.GET("/:id", handlers.GetBuildDetails) // GET /api/user/builds/:id
				builds.PUT("/:id", handlers.UpdateBuild)     // PUT /api/user/builds/:id
				builds.DELETE("/:id", handlers.DeleteBuild)  // DELETE /api/user/builds/:id
			}
		}

		// ===================
		// ADMIN ROUTES
		// ===================
		admin := api.Group("/admin")
		admin.Use(middleware.ClerkAuthMiddleware(), middleware.RequireAdmin())
		{
			// Admin products management (full CRUD with pagination)
			adminProducts := admin.Group("/products")
			{
				adminProducts.GET("", handlers.GetAdminProducts)                // GET /api/admin/products?page=&limit=&search=&category=
				adminProducts.GET("/:id", handlers.GetAdminProduct)             // GET /api/admin/products/:id
				adminProducts.POST("", handlers.CreatePart)                     // POST /api/admin/products
				adminProducts.PUT("/:id", handlers.UpdateAdminProduct)          // PUT /api/admin/products/:id
				adminProducts.PATCH("/:id/anchors", handlers.UpdatePartAnchors) // PATCH /api/admin/products/:id/anchors
				adminProducts.DELETE("/:id", handlers.DeleteAdminProduct)       // DELETE /api/admin/products/:id (soft delete)
			}

			// Legacy admin parts routes (deprecated, use /products)
			adminParts := admin.Group("/parts")
			{
				adminParts.POST("", handlers.CreatePart)
				adminParts.PUT("/:id", handlers.UpdatePart)
				adminParts.PATCH("/:id/anchors", handlers.UpdatePartAnchors)
				adminParts.DELETE("/:id", handlers.DeletePart)
			}

			// Storage endpoints
			admin.GET("/upload-token", handlers.GenerateUploadToken)
			admin.GET("/download-token", handlers.GenerateDownloadToken)
		}
	}

	log.Printf("Starting PC Builder 3D API server on port %s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
