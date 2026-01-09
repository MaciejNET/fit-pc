package handlers

import (
	"net/http"
	"strconv"

	"fit-pc/db"
	"fit-pc/models"

	"github.com/gin-gonic/gin"
)

// GetParts returns all products, optionally filtered by category
// GET /api/parts?category=...
func GetParts(c *gin.Context) {
	var products []models.Product
	query := db.GetDB()

	// Filter by category if provided
	if category := c.Query("category"); category != "" {
		query = query.Where("category = ?", category)
	}

	if err := query.Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch products",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  products,
		"count": len(products),
	})
}

// GetPartDetails returns a single product by ID
// GET /api/parts/:id
func GetPartDetails(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid product ID",
		})
		return
	}

	var product models.Product
	if err := db.GetDB().First(&product, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Product not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": product,
	})
}

// GetCompatibleParts returns parts compatible with the given parent part's anchor points
// GET /api/parts/:id/compatible
func GetCompatibleParts(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid product ID",
		})
		return
	}

	// Get the parent part
	var parentPart models.Product
	if err := db.GetDB().First(&parentPart, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Product not found",
		})
		return
	}

	// Check if parent has anchor points
	if len(parentPart.AnchorPoints) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"data":        []models.Product{},
			"message":     "No anchor points defined for this part",
			"parent_part": parentPart,
		})
		return
	}

	// Collect all compatible types from anchor points
	compatibleTypesSet := make(map[string]bool)
	anchorCompatibility := make(map[string][]string) // anchor name -> compatible types

	for _, anchor := range parentPart.AnchorPoints {
		anchorCompatibility[anchor.Name] = anchor.CompatibleTypes
		for _, ct := range anchor.CompatibleTypes {
			compatibleTypesSet[ct] = true
		}
	}

	// Convert to slice for query
	compatibleCategories := make([]string, 0, len(compatibleTypesSet))
	for cat := range compatibleTypesSet {
		compatibleCategories = append(compatibleCategories, cat)
	}

	// Find compatible parts by category
	var compatibleParts []models.Product
	if len(compatibleCategories) > 0 {
		if err := db.GetDB().Where("category IN ?", compatibleCategories).Find(&compatibleParts).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to fetch compatible parts",
			})
			return
		}
	}

	// Advanced compatibility check: match socket types
	// This filters parts based on TechnicalSpecs.Socket matching anchor CompatibleTypes
	filteredParts := FilterBySocketCompatibility(parentPart, compatibleParts)

	c.JSON(http.StatusOK, gin.H{
		"data":                 filteredParts,
		"count":                len(filteredParts),
		"parent_part":          parentPart,
		"anchor_compatibility": anchorCompatibility,
	})
}

func FilterBySocketCompatibility(parent models.Product, candidates []models.Product) []models.Product {
	result := make([]models.Product, 0)

	for _, candidate := range candidates {
		candidateSocket, hasSocket := candidate.TechnicalSpecs["socket"]
		if !hasSocket {
			result = append(result, candidate)
			continue
		}

		socketStr, ok := candidateSocket.(string)
		if !ok {
			result = append(result, candidate)
			continue
		}

		for _, anchor := range parent.AnchorPoints {
			for _, compatType := range anchor.CompatibleTypes {
				if compatType == socketStr || compatType == candidate.Category {
					result = append(result, candidate)
					goto nextCandidate
				}
			}
		}
	nextCandidate:
	}

	return result
}

// CreatePartRequest represents the request body for creating a part
type CreatePartRequest struct {
	Name           string                 `json:"name" binding:"required"`
	SKU            string                 `json:"sku" binding:"required"`
	Category       string                 `json:"category" binding:"required"`
	Price          float64                `json:"price" binding:"required,gte=0"`
	ModelURL       string                 `json:"model_url"`
	ThumbnailURL   string                 `json:"thumbnail_url"`
	TechnicalSpecs map[string]interface{} `json:"technical_specs"`
	AnchorPoints   []models.AnchorPoint   `json:"anchor_points"`
}

// CreatePart creates a new product (Admin only)
// POST /api/admin/parts
func CreatePart(c *gin.Context) {
	var req CreatePartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	product := models.Product{
		Name:           req.Name,
		SKU:            req.SKU,
		Category:       req.Category,
		Price:          req.Price,
		ModelURL:       req.ModelURL,
		ThumbnailURL:   req.ThumbnailURL,
		TechnicalSpecs: req.TechnicalSpecs,
		AnchorPoints:   req.AnchorPoints,
	}

	if err := db.GetDB().Create(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to create product",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Product created successfully",
		"data":    product,
	})
}

// UpdateAnchorPointsRequest represents the request body for updating anchor points
type UpdateAnchorPointsRequest struct {
	AnchorPoints []models.AnchorPoint `json:"anchor_points" binding:"required"`
}

// UpdatePartAnchors updates only the anchor points of a product (Admin only)
// Used by the 3D Visual Editor
// PATCH /api/admin/parts/:id/anchors
func UpdatePartAnchors(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid product ID",
		})
		return
	}

	var req UpdateAnchorPointsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Check if product exists
	var product models.Product
	if err := db.GetDB().First(&product, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Product not found",
		})
		return
	}

	// Update only the anchor points
	if err := db.GetDB().Model(&product).Update("anchor_points", models.AnchorPoints(req.AnchorPoints)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to update anchor points",
			"details": err.Error(),
		})
		return
	}

	// Reload the product to get updated data
	db.GetDB().First(&product, id)

	c.JSON(http.StatusOK, gin.H{
		"message": "Anchor points updated successfully",
		"data":    product,
	})
}

// UpdatePartRequest represents the request body for updating a part
type UpdatePartRequest struct {
	Name           *string                `json:"name"`
	SKU            *string                `json:"sku"`
	Category       *string                `json:"category"`
	Price          *float64               `json:"price"`
	ModelURL       *string                `json:"model_url"`
	ThumbnailURL   *string                `json:"thumbnail_url"`
	TechnicalSpecs map[string]interface{} `json:"technical_specs"`
	AnchorPoints   []models.AnchorPoint   `json:"anchor_points"`
}

// UpdatePart updates a product (Admin only)
// PUT /api/admin/parts/:id
func UpdatePart(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid product ID",
		})
		return
	}

	var product models.Product
	if err := db.GetDB().First(&product, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Product not found",
		})
		return
	}

	var req UpdatePartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Update fields if provided
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.SKU != nil {
		updates["sku"] = *req.SKU
	}
	if req.Category != nil {
		updates["category"] = *req.Category
	}
	if req.Price != nil {
		updates["price"] = *req.Price
	}
	if req.ModelURL != nil {
		updates["model_url"] = *req.ModelURL
	}
	if req.ThumbnailURL != nil {
		updates["thumbnail_url"] = *req.ThumbnailURL
	}
	if req.TechnicalSpecs != nil {
		updates["technical_specs"] = models.TechnicalSpecs(req.TechnicalSpecs)
	}
	if req.AnchorPoints != nil {
		updates["anchor_points"] = models.AnchorPoints(req.AnchorPoints)
	}

	if err := db.GetDB().Model(&product).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to update product",
			"details": err.Error(),
		})
		return
	}

	// Reload product
	db.GetDB().First(&product, id)

	c.JSON(http.StatusOK, gin.H{
		"message": "Product updated successfully",
		"data":    product,
	})
}

// DeletePart deletes a product (Admin only)
// DELETE /api/admin/parts/:id
func DeletePart(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid product ID",
		})
		return
	}

	var product models.Product
	if err := db.GetDB().First(&product, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Product not found",
		})
		return
	}

	if err := db.GetDB().Delete(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete product",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Product deleted successfully",
	})
}
