package config

import (
	"context"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/Azure/azure-sdk-for-go/sdk/keyvault/azsecrets"
)

type Config struct {
	DBConnectionString string
	StorageAccountName string
	StorageAccountKey  string
	ClerkSecretKey     string
	Port               string
}

type secretMapping struct {
	keyVaultName string
	target       *string
	required     bool
}

var (
	instance *Config
	once     sync.Once
)

func LoadConfig() *Config {
	once.Do(func() {
		instance = loadFromKeyVault()
	})
	return instance
}

func GetConfig() *Config {
	if instance == nil {
		panic("config not initialized: call LoadConfig() first")
	}
	return instance
}

func loadFromKeyVault() *Config {
	cfg := &Config{
		Port: getEnvOrDefault("PORT", "8080"),
	}

	vaultURL := os.Getenv("AZURE_KEYVAULT_URL")
	if vaultURL == "" {
		panic("AZURE_KEYVAULT_URL environment variable is required")
	}

	cred, err := azidentity.NewDefaultAzureCredential(nil)
	if err != nil {
		panic(fmt.Sprintf("failed to create Azure credential: %v", err))
	}

	client, err := azsecrets.NewClient(vaultURL, cred, nil)
	if err != nil {
		panic(fmt.Sprintf("failed to create Key Vault client: %v", err))
	}

	mappings := []secretMapping{
		{keyVaultName: "db-connection-string", target: &cfg.DBConnectionString, required: true},
		{keyVaultName: "storage-account-name", target: &cfg.StorageAccountName, required: true},
		{keyVaultName: "storage-account-key", target: &cfg.StorageAccountKey, required: true},
		{keyVaultName: "clerk-secret-key", target: &cfg.ClerkSecretKey, required: true},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var wg sync.WaitGroup
	errChan := make(chan error, len(mappings))

	for _, m := range mappings {
		wg.Add(1)
		go func(mapping secretMapping) {
			defer wg.Done()

			resp, err := client.GetSecret(ctx, mapping.keyVaultName, "", nil)
			if err != nil {
				if mapping.required {
					errChan <- fmt.Errorf("failed to fetch required secret %q: %w", mapping.keyVaultName, err)
				}
				return
			}

			if resp.Value != nil {
				*mapping.target = *resp.Value
			} else if mapping.required {
				errChan <- fmt.Errorf("secret %q has nil value", mapping.keyVaultName)
			}
		}(m)
	}

	wg.Wait()
	close(errChan)

	var errors []error
	for err := range errChan {
		errors = append(errors, err)
	}

	if len(errors) > 0 {
		panic(fmt.Sprintf("failed to load configuration: %v", errors))
	}

	return cfg
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
