import axios from 'axios';

interface UploadTokenResponse {
    upload_url: string;
    blob_url: string;
}

/**
 * Uploads a file directly to Azure Blob Storage using a SAS Token pattern.
 * 
 * Flow:
 * 1. Request SAS Token (upload_url) from Backend.
 * 2. PUT file content to Azure directly.
 * 3. Return the public/accessible blob_url.
 * 
 * @param file The Browser File object to upload.
 * @returns Promise resolving to the final Blob URL.
 */
export async function uploadFileToAzure(file: File): Promise<string> {
    const filename = encodeURIComponent(file.name);

    try {
        // 1. Get SAS Token from Backend
        // Note: Adjust the endpoint path if your API structure differs
        const tokenResponse = await axios.get<UploadTokenResponse>(
            `/api/admin/upload-token?filename=${filename}`
        );

        const { upload_url, blob_url } = tokenResponse.data;

        if (!upload_url || !blob_url) {
            throw new Error("Invalid response from upload-token endpoint.");
        }

        // 2. Upload to Azure (Direct PUT)
        await axios.put(upload_url, file, {
            headers: {
                'Content-Type': file.type || 'application/octet-stream',
                'x-ms-blob-type': 'BlockBlob', // CEITICAL for Azure Block Blobs
            },
        });

        return blob_url;
    } catch (error: any) {
        console.error("Azure Upload Failed:", error);

        // Enhancing error message for better UI feedback
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 403) {
                throw new Error("Upload Failed: Permission denied or SAS token rejected.");
            }
            throw new Error(`Upload Failed: ${error.message}`);
        }

        throw error;
    }
}
