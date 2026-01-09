import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const BACKEND_BASE_URL = process.env.BACKEND_URL || "http://localhost:8081";

export async function POST(request: Request) {
    try {
        const { getToken } = await auth();
        const token = await getToken();

        // Get the file from the form data
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            );
        }

        // Step 1: Get the upload token from the backend
        const tokenResponse = await fetch(
            `${BACKEND_BASE_URL}/api/admin/upload-token?filename=${encodeURIComponent(file.name)}`,
            {
                headers: {
                    Authorization: token ? `Bearer ${token}` : "",
                },
            }
        );

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            return NextResponse.json(
                { error: `Failed to get upload token: ${errorText}` },
                { status: tokenResponse.status }
            );
        }

        const { upload_url, blob_url } = await tokenResponse.json();

        // Step 2: Upload the file to Azure (server-side, no CORS issues)
        const fileBuffer = await file.arrayBuffer();
        const uploadResponse = await fetch(upload_url, {
            method: "PUT",
            headers: {
                "x-ms-blob-type": "BlockBlob",
                "Content-Type": file.type || "application/octet-stream",
            },
            body: fileBuffer,
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            return NextResponse.json(
                { error: `Failed to upload to Azure: ${errorText}` },
                { status: uploadResponse.status }
            );
        }

        // Step 3: Return the blob URL to the client
        return NextResponse.json({ blob_url });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { error: "Upload failed" },
            { status: 500 }
        );
    }
}
