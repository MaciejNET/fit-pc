import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export async function GET(req: NextRequest) {
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blobName = req.nextUrl.searchParams.get("blob");
  if (!blobName) {
    return NextResponse.json({ error: "Missing blob parameter" }, { status: 400 });
  }

  try {
    // Get SAS token for download from backend
    const backendUrl = `${BACKEND_URL}/api/admin/download-token?blob=${encodeURIComponent(blobName)}`;

    const tokenRes = await fetch(backendUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!tokenRes.ok) {
      const error = await tokenRes.text();
      console.error("Backend error:", tokenRes.status, error);
      return NextResponse.json(
        { error: `Failed to get download token: ${error}` },
        { status: tokenRes.status }
      );
    }

    const data = await tokenRes.json();

    // Fetch the blob from Azure server-side (bypasses CORS)
    const blobRes = await fetch(data.download_url);

    if (!blobRes.ok) {
      console.error("Azure fetch error:", blobRes.status, blobRes.statusText);
      return NextResponse.json(
        { error: `Failed to download blob: ${blobRes.statusText}` },
        { status: blobRes.status }
      );
    }

    // Stream the blob back to the client
    const blob = await blobRes.arrayBuffer();

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "model/gltf-binary",
        "Content-Length": blob.byteLength.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Download model error:", error);
    return NextResponse.json(
      { error: `Failed to download model: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
