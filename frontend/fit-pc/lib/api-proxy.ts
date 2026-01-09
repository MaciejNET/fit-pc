import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const BACKEND_BASE_URL = process.env.BACKEND_URL || "http://localhost:8081";

interface ProxyOptions {
    endpoint: string;
    method?: string;
    body?: any;
}

/**
 * Forwards a request to the backend service with the current user's authentication token.
 */
export async function proxyRequest(request: Request, targetEndpoint: string) {
    const { getToken } = await auth();
    const token = await getToken();

    // Prepare URL
    // If the incoming request has search params, we might want to pass them or rely on targetEndpoint having them.
    // For simplicity here, we assume targetEndpoint includes query params if needed, 
    // OR we can append the incoming request's search params.
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();
    const finalUrl = `${BACKEND_BASE_URL}${targetEndpoint}${searchParams ? `?${searchParams}` : ""}`;

    // Prepare Headers
    const headers: HeadersInit = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    // Prepare Body
    let body = undefined;
    const method = request.method;

    if (method !== "GET" && method !== "HEAD") {
        try {
            // Clone request to read body so we don't consume it if used elsewhere (though in route handlers usually fine)
            const jsonBody = await request.json();
            body = JSON.stringify(jsonBody);
        } catch (e) {
            // Body might be empty or invalid JSON, ignore
        }
    }

    try {
        const response = await fetch(finalUrl, {
            method,
            headers,
            body,
        });

        // Handle non-JSON responses or empty bodies
        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            data = responseText;
        }

        if (!response.ok) {
            console.error(`[Proxy Error] ${method} ${finalUrl}: ${response.status}`, data);
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data, { status: 200 });

    } catch (error) {
        console.error("[Proxy Fatal Error]", error);
        return NextResponse.json({ error: "Internal Proxy Error" }, { status: 500 });
    }
}
