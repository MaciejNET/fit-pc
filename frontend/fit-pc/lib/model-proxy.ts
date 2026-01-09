/**
 * Converts Azure Blob Storage URL to proxied URL to bypass CORS
 * @param url Original blob storage URL
 * @returns Proxied URL or original if not a blob URL
 */
export function getProxiedModelUrl(url: string | undefined | null): string {
    if (!url) return '';

    // If it's already a local URL or proxy URL, return as-is
    if (url.startsWith('/api/') || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
        return url;
    }

    // If it's an Azure Blob Storage URL, proxy it
    if (url.includes('blob.core.windows.net')) {
        return `/api/proxy-model?url=${encodeURIComponent(url)}`;
    }

    // Return original URL for other cases
    return url;
}
