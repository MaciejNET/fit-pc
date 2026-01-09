package handlers

import (
	"net/http"
	"strconv"

	"fit-pc/db"
	"fit-pc/middleware"
	"fit-pc/models"

	"github.com/gin-gonic/gin"
)

// SaveBuildRequest represents the request body for saving a build
type SaveBuildComponent struct {
	ID             uint                   `json:"id"`
	Name           string                 `json:"name" binding:"required"`
	Category       string                 `json:"category" binding:"required"`
	Price          float64                `json:"price"`
	ModelURL       string                 `json:"model_url"`
	TechnicalSpecs map[string]interface{} `json:"technical_specs"`
	AnchorPoints   []models.AnchorPoint   `json:"anchor_points"`
	Quantity       int                    `json:"quantity,omitempty"`
}

type SaveBuildRequest struct {
	Name       string               `json:"name" binding:"required"`
	Components []SaveBuildComponent `json:"components" binding:"required"`
}

// SaveBuild saves a new PC build for the authenticated user
// POST /api/user/builds
func SaveBuild(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	var req SaveBuildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Convert request components to model components and calculate total price
	var totalPrice float64
	components := make(models.BuildComponents, len(req.Components))
	for i, comp := range req.Components {
		quantity := comp.Quantity
		if quantity == 0 {
			quantity = 1
		}
		totalPrice += comp.Price * float64(quantity)

		components[i] = models.BuildComponent{
			ID:             comp.ID,
			Name:           comp.Name,
			Category:       comp.Category,
			Price:          comp.Price,
			ModelURL:       comp.ModelURL,
			TechnicalSpecs: comp.TechnicalSpecs,
			AnchorPoints:   comp.AnchorPoints,
			Quantity:       quantity,
		}
	}

	build := models.Build{
		UserID:     userID,
		Name:       req.Name,
		Components: components,
		TotalPrice: totalPrice,
	}

	if err := db.GetDB().Create(&build).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to save build",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Build saved successfully",
		"data":    build,
	})
}

// GetUserBuilds returns all builds for the authenticated user
// GET /api/user/builds
func GetUserBuilds(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	var builds []models.Build
	if err := db.GetDB().Where("user_id = ?", userID).Order("created_at DESC").Find(&builds).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch builds",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  builds,
		"count": len(builds),
	})
}

// GetBuildDetails returns a specific build with its components
// GET /api/user/builds/:id
func GetBuildDetails(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid build ID",
		})
		return
	}

	var build models.Build
	if err := db.GetDB().Where("id = ? AND user_id = ?", id, userID).First(&build).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Build not found",
		})
		return
	}

	// Components are already stored in the build
	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"build":       build,
			"components":  build.Components,
			"total_price": build.TotalPrice,
		},
	})
}

// UpdateBuildRequest represents the request body for updating a build
type UpdateBuildRequest struct {
	Name       *string              `json:"name"`
	Components []SaveBuildComponent `json:"components"`
}

// UpdateBuild updates an existing build
// PUT /api/user/builds/:id
func UpdateBuild(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid build ID",
		})
		return
	}

	var build models.Build
	if err := db.GetDB().Where("id = ? AND user_id = ?", id, userID).First(&build).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Build not found",
		})
		return
	}

	var req UpdateBuildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Update fields
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Components != nil {
		// Convert and calculate total price
		var totalPrice float64
		components := make(models.BuildComponents, len(req.Components))
		for i, comp := range req.Components {
			quantity := comp.Quantity
			if quantity == 0 {
				quantity = 1
			}
			totalPrice += comp.Price * float64(quantity)

			components[i] = models.BuildComponent{
				ID:             comp.ID,
				Name:           comp.Name,
				Category:       comp.Category,
				Price:          comp.Price,
				ModelURL:       comp.ModelURL,
				TechnicalSpecs: comp.TechnicalSpecs,
				AnchorPoints:   comp.AnchorPoints,
				Quantity:       quantity,
			}
		}
		updates["components"] = components
		updates["total_price"] = totalPrice
	}

	if err := db.GetDB().Model(&build).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to update build",
			"details": err.Error(),
		})
		return
	}

	// Reload build
	db.GetDB().First(&build, id)

	c.JSON(http.StatusOK, gin.H{
		"message": "Build updated successfully",
		"data":    build,
	})
}

// DeleteBuild deletes a user's build
// DELETE /api/user/builds/:id
func DeleteBuild(c *gin.Context) {
	userID, exists := middleware.GetUserIDFromContext(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid build ID",
		})
		return
	}

	var build models.Build
	if err := db.GetDB().Where("id = ? AND user_id = ?", id, userID).First(&build).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Build not found",
		})
		return
	}

	if err := db.GetDB().Delete(&build).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete build",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Build deleted successfully",
	})
}
