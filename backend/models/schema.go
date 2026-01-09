package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"
)

// Vector3 represents a 3D coordinate or rotation
type Vector3 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// AnchorPoint defines a connection point on a parent part
type AnchorPoint struct {
	Name            string   `json:"name"`
	Label           string   `json:"label"`
	Position        Vector3  `json:"position"`
	Rotation        Vector3  `json:"rotation"`
	Direction       string   `json:"direction"`       // "input" or "output"
	ConnectionAxis  string   `json:"connection_axis"` // "Y_NEG", "Y_POS", "Z_NEG", "Z_POS", "X_NEG", "X_POS"
	CompatibleTypes []string `json:"compatible_types"`
}

// AnchorPoints is a slice of AnchorPoint for JSONB storage
type AnchorPoints []AnchorPoint

// Value implements driver.Valuer for database serialization
func (a AnchorPoints) Value() (driver.Value, error) {
	if a == nil {
		return nil, nil
	}
	return json.Marshal(a)
}

// Scan implements sql.Scanner for database deserialization
func (a *AnchorPoints) Scan(value interface{}) error {
	if value == nil {
		*a = nil
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("failed to unmarshal AnchorPoints value")
	}

	return json.Unmarshal(bytes, a)
}

// TechnicalSpecs represents the technical specifications JSONB field
type TechnicalSpecs map[string]interface{}

// Value implements driver.Valuer for database serialization
func (t TechnicalSpecs) Value() (driver.Value, error) {
	if t == nil {
		return nil, nil
	}
	return json.Marshal(t)
}

// Scan implements sql.Scanner for database deserialization
func (t *TechnicalSpecs) Scan(value interface{}) error {
	if value == nil {
		*t = nil
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("failed to unmarshal TechnicalSpecs value")
	}

	return json.Unmarshal(bytes, t)
}

// ComponentIDs represents a list of product IDs stored as JSONB
type ComponentIDs []int64

// Value implements driver.Valuer for database serialization
func (c ComponentIDs) Value() (driver.Value, error) {
	if c == nil {
		return nil, nil
	}
	return json.Marshal(c)
}

// Scan implements sql.Scanner for database deserialization
func (c *ComponentIDs) Scan(value interface{}) error {
	if value == nil {
		*c = nil
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("failed to unmarshal ComponentIDs value")
	}

	return json.Unmarshal(bytes, c)
}

// Product represents a PC component/part in the system
type Product struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	Name           string         `gorm:"not null;size:255" json:"name"`
	SKU            string         `gorm:"uniqueIndex;size:100" json:"sku"`
	Category       string         `gorm:"index;size:50" json:"category"`
	Price          float64        `gorm:"type:decimal(10,2)" json:"price"`
	ModelURL       string         `gorm:"size:500" json:"model_url"`
	ThumbnailURL   string         `gorm:"size:500" json:"thumbnail_url"`
	TechnicalSpecs TechnicalSpecs `gorm:"type:jsonb" json:"technical_specs"`
	AnchorPoints   AnchorPoints   `gorm:"type:jsonb" json:"anchor_points"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

// BuildComponent represents a component snapshot saved with a build
type BuildComponent struct {
	ID             uint           `json:"id"`
	Name           string         `json:"name"`
	Category       string         `json:"category"`
	Price          float64        `json:"price"`
	ModelURL       string         `json:"model_url"`
	TechnicalSpecs TechnicalSpecs `json:"technical_specs"`
	AnchorPoints   AnchorPoints   `json:"anchor_points"`
	Quantity       int            `json:"quantity,omitempty"` // For RAM modules
}

// BuildComponents is a slice of BuildComponent for JSONB storage
type BuildComponents []BuildComponent

// Value implements driver.Valuer for database serialization
func (b BuildComponents) Value() (driver.Value, error) {
	if b == nil {
		return nil, nil
	}
	return json.Marshal(b)
}

// Scan implements sql.Scanner for database deserialization
func (b *BuildComponents) Scan(value interface{}) error {
	if value == nil {
		*b = nil
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("failed to unmarshal BuildComponents value")
	}

	return json.Unmarshal(bytes, b)
}

// Build represents a user's PC build configuration
type Build struct {
	ID         uint            `gorm:"primaryKey" json:"id"`
	UserID     string          `gorm:"index;not null;size:255" json:"user_id"`
	Name       string          `gorm:"not null;size:255" json:"name"`
	Components BuildComponents `gorm:"type:jsonb" json:"components"`
	TotalPrice float64         `gorm:"type:decimal(10,2)" json:"total_price"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
	DeletedAt  gorm.DeletedAt  `gorm:"index" json:"-"`
}

// TableName specifies the table name for Product
func (Product) TableName() string {
	return "products"
}

// TableName specifies the table name for Build
func (Build) TableName() string {
	return "builds"
}
