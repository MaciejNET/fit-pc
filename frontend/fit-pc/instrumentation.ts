import { getSecret } from "@/lib/keyvault";
import * as dotenv from "dotenv";

// Load environment variables from .env file if present
dotenv.config();

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        console.log("🏁 Server Starting: Initializing Key Vault Secrets...");

        // Map: Key Vault Name -> process.env Variable Name
        const SECRET_MAPPING: Record<string, string> = {
            "clerk-secret-key": "CLERK_SECRET_KEY",
            "clerk-publishable-key": "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
            "storage-account-name": "AZURE_STORAGE_ACCOUNT",
        };

        try {
            const results = await Promise.allSettled(
                Object.entries(SECRET_MAPPING).map(async ([kvName, envName]) => {
                    const value = await getSecret(kvName);
                    if (value) {
                        process.env[envName] = value;
                        return envName;
                    } else {
                        throw new Error(`Secret '${kvName}' was empty or failed to load.`);
                    }
                })
            );

            const successCount = results.filter((r) => r.status === "fulfilled").length;
            console.log(`✅ Loaded ${successCount}/${Object.keys(SECRET_MAPPING).length} secrets into process.env.`);

            // Log failures for debugging (without leaking secrets)
            results.forEach((result, index) => {
                if (result.status === "rejected") {
                    const kvName = Object.keys(SECRET_MAPPING)[index];
                    console.error(`❌ Failed to load '${kvName}':`, result.reason);
                }
            });

        } catch (error) {
            console.error("❌ Critical error during secret loading:", error);
        }
    }
}
