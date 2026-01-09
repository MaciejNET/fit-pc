package handlers

import (
	"math"
	"net/http"
	"strconv"

	"fit-pc/db"
	"fit-pc/models"

	"github.com/gin-gonic/gin"
)

type ProductListQuery struct {
	Page     int    `form:"page,default=1" binding:"min=1"`
	Limit    int    `form:"limit,default=10" binding:"min=1,max=100"`
	Search   string `form:"search"`
	Category string `form:"category"`
}

type PaginationMeta struct {
	Total    int64 `json:"total"`
	Page     int   `json:"page"`
	LastPage int   `json:"last_page"`
}

// GetAdminProduct returns a single product by ID
func GetAdminProduct(c *gin.Context) {
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

	c.JSON(http.StatusOK, product)
}

func GetAdminProducts(c *gin.Context) {
	var query ProductListQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid query parameters",
			"details": err.Error(),
		})
		return
	}

	dbQuery := db.GetDB().Model(&models.Product{})

	if query.Search != "" {
		searchPattern := "%" + query.Search + "%"
		dbQuery = dbQuery.Where("name ILIKE ? OR sku ILIKE ?", searchPattern, searchPattern)
	}

	if query.Category != "" {
		dbQuery = dbQuery.Where("category = ?", query.Category)
	}

	var total int64
	if err := dbQuery.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to count products",
		})
		return
	}

	offset := (query.Page - 1) * query.Limit
	lastPage := int(math.Ceil(float64(total) / float64(query.Limit)))
	if lastPage == 0 {
		lastPage = 1
	}

	var products []models.Product
	if err := dbQuery.Offset(offset).Limit(query.Limit).Order("id DESC").Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch products",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": products,
		"meta": PaginationMeta{
			Total:    total,
			Page:     query.Page,
			LastPage: lastPage,
		},
	})
}

type AdminUpdateProductRequest struct {
	Name           *string                `json:"name"`
	SKU            *string                `json:"sku"`
	Category       *string                `json:"category"`
	Price          *float64               `json:"price"`
	ModelURL       *string                `json:"model_url"`
	ThumbnailURL   *string                `json:"thumbnail_url"`
	TechnicalSpecs map[string]interface{} `json:"technical_specs"`
	AnchorPoints   []models.AnchorPoint   `json:"anchor_points"`
}

func UpdateAdminProduct(c *gin.Context) {
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

	var req AdminUpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

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

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "No fields to update",
		})
		return
	}

	if err := db.GetDB().Model(&product).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to update product",
			"details": err.Error(),
		})
		return
	}

	db.GetDB().First(&product, id)

	c.JSON(http.StatusOK, gin.H{
		"message": "Product updated successfully",
		"data":    product,
	})
}

func DeleteAdminProduct(c *gin.Context) {
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

	// Hard delete - physically remove from database (use Unscoped to bypass soft delete)
	if err := db.GetDB().Unscoped().Delete(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete product",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Product deleted successfully",
	})
}
