package handlers

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"fit-pc/internal/config"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/sas"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	defaultContainerName = "models"
	sasTokenExpiry       = 15 * time.Minute
)

type UploadTokenResponse struct {
	UploadURL string `json:"upload_url"`
	BlobURL   string `json:"blob_url"`
	BlobName  string `json:"blob_name"`
	ExpiresAt string `json:"expires_at"`
}

func GenerateUploadToken(c *gin.Context) {
	filename := c.Query("filename")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "filename query parameter is required",
		})
		return
	}

	ext := strings.ToLower(filepath.Ext(filename))
	allowedExtensions := map[string]bool{
		".glb":  true,
		".gltf": true,
		".png":  true,
		".jpg":  true,
		".jpeg": true,
	}

	if !allowedExtensions[ext] {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid file extension",
			"allowed": []string{".glb", ".gltf", ".png", ".jpg", ".jpeg"},
		})
		return
	}

	blobName := fmt.Sprintf("%s%s", uuid.New().String(), ext)

	cfg := config.GetConfig()

	credential, err := azblob.NewSharedKeyCredential(cfg.StorageAccountName, cfg.StorageAccountKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to create storage credential",
		})
		return
	}

	expiryTime := time.Now().UTC().Add(sasTokenExpiry)

	permissions := sas.BlobPermissions{
		Write:  true,
		Create: true,
	}

	sasValues := sas.BlobSignatureValues{
		Protocol:      sas.ProtocolHTTPS,
		StartTime:     time.Now().UTC().Add(-5 * time.Minute),
		ExpiryTime:    expiryTime,
		Permissions:   permissions.String(),
		ContainerName: defaultContainerName,
		BlobName:      blobName,
	}

	queryParams, err := sasValues.SignWithSharedKey(credential)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to sign SAS token",
		})
		return
	}

	blobURL := fmt.Sprintf(
		"https://%s.blob.core.windows.net/%s/%s",
		cfg.StorageAccountName,
		defaultContainerName,
		blobName,
	)

	uploadURL := fmt.Sprintf("%s?%s", blobURL, queryParams.Encode())

	c.JSON(http.StatusOK, UploadTokenResponse{
		UploadURL: uploadURL,
		BlobURL:   blobURL,
		BlobName:  blobName,
		ExpiresAt: expiryTime.Format(time.RFC3339),
	})
}

func GenerateDownloadToken(c *gin.Context) {
	blobName := c.Query("blob")
	if blobName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "blob query parameter is required",
		})
		return
	}

	cfg := config.GetConfig()

	credential, err := azblob.NewSharedKeyCredential(cfg.StorageAccountName, cfg.StorageAccountKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to create storage credential",
		})
		return
	}

	expiryTime := time.Now().UTC().Add(1 * time.Hour)

	permissions := sas.BlobPermissions{
		Read: true,
	}

	sasValues := sas.BlobSignatureValues{
		Protocol:      sas.ProtocolHTTPS,
		StartTime:     time.Now().UTC().Add(-5 * time.Minute),
		ExpiryTime:    expiryTime,
		Permissions:   permissions.String(),
		ContainerName: defaultContainerName,
		BlobName:      blobName,
	}

	queryParams, err := sasValues.SignWithSharedKey(credential)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to sign SAS token",
		})
		return
	}

	blobURL := fmt.Sprintf(
		"https://%s.blob.core.windows.net/%s/%s",
		cfg.StorageAccountName,
		defaultContainerName,
		blobName,
	)

	downloadURL := fmt.Sprintf("%s?%s", blobURL, queryParams.Encode())

	c.JSON(http.StatusOK, gin.H{
		"download_url": downloadURL,
		"expires_at":   expiryTime.Format(time.RFC3339),
	})
}
