import { SecretClient } from "@azure/keyvault-secrets";
import { DefaultAzureCredential } from "@azure/identity";

// Module-level cache (Singleton pattern via module caching)
const secretCache = new Map<string, string>();
let client: SecretClient | null = null;

function getClient(): SecretClient | null {
    if (client) return client;

    const vaultUrl = process.env.KEY_VAULT_URL;
    if (!vaultUrl) {
        console.warn("⚠️ KEY_VAULT_URL is not defined. Key Vault integration disabled.");
        return null;
    }

    try {
        const credential = new DefaultAzureCredential();
        client = new SecretClient(vaultUrl, credential);
        return client;
    } catch (error) {
        console.error("❌ Failed to initialize Key Vault client:", error);
        return null;
    }
}

/**
 * Retrieves a secret from Azure Key Vault or memory cache.
 * @param secretName The name of the secret in Key Vault (kebab-case)
 */
export async function getSecret(secretName: string): Promise<string | undefined> {
    // 1. Check Cache
    if (secretCache.has(secretName)) {
        return secretCache.get(secretName);
    }

    const kvClient = getClient();
    if (!kvClient) return undefined;

    // 2. Fetch from Azure
    try {
        const secret = await kvClient.getSecret(secretName);
        const value = secret.value;

        if (value) {
            // 3. Cache it
            secretCache.set(secretName, value);
            return value;
        }
    } catch (error) {
        console.error(`❌ Error fetching secret '${secretName}':`, error);
        // Graceful failure: return undefined instead of throwing, per requirement
    }

    return undefined;
}
