import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get("url");

    if (!url) {
        return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    // Only allow blob.core.windows.net URLs for security
    if (!url.includes("blob.core.windows.net")) {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    try {
        // Extract blob name from URL
        // Format: https://safitpc.blob.core.windows.net/models/filename.glb
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        const blobName = pathParts.slice(2).join('/'); // Skip empty and container name

        if (!blobName) {
            return NextResponse.json({ error: "Invalid blob URL" }, { status: 400 });
        }

        // Get SAS token from backend (public endpoint, no auth needed for reading)
        const tokenRes = await fetch(
            `${BACKEND_URL}/api/download-token?blob=${encodeURIComponent(blobName)}`
        );

        if (!tokenRes.ok) {
            const error = await tokenRes.text();
            console.error("Backend error:", tokenRes.status, error);
            return NextResponse.json(
                { error: `Failed to get download token: ${error}` },
                { status: tokenRes.status }
            );
        }

        const data = await tokenRes.json();
        const downloadUrl = data.download_url;

        if (!downloadUrl) {
            return NextResponse.json(
                { error: "No download URL received from backend" },
                { status: 500 }
            );
        }

        // Fetch the model with SAS token
        const response = await fetch(downloadUrl);

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch model: ${response.statusText}` },
                { status: response.status }
            );
        }

        const arrayBuffer = await response.arrayBuffer();

        return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
                "Content-Type": "model/gltf-binary",
                "Cache-Control": "public, max-age=3600",
            },
        });
    } catch (error) {
        console.error("Error proxying model:", error);
        return NextResponse.json(
            { error: `Failed to fetch model: ${error instanceof Error ? error.message : String(error)}` },
            { status: 500 }
        );
    }
}
