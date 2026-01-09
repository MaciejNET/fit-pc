import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Forward query params to backend
        const params = new URLSearchParams();

        const category = searchParams.get("category");
        const search = searchParams.get("search");
        const limit = searchParams.get("limit") || "50";
        const page = searchParams.get("page") || "1";

        if (category) params.set("category", category);
        if (search) params.set("search", search);
        params.set("limit", limit);
        params.set("page", page);

        // Use public /api/parts endpoint (no auth required)
        const response = await fetch(
            `${BACKEND_URL}/api/parts?${params.toString()}`,
            {
                headers: {
                    "Content-Type": "application/json",
                },
                cache: "no-store",
            }
        );

        if (!response.ok) {
            console.error("Backend error:", response.status);
            return NextResponse.json(
                { error: "Failed to fetch products" },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Error fetching products:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
