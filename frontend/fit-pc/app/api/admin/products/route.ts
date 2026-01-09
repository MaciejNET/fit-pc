import { proxyRequest } from "@/lib/api-proxy";

export async function GET(request: Request) {
    // Proxy to Backend: GET /api/admin/products
    return proxyRequest(request, "/api/admin/products");
}

export async function POST(request: Request) {
    // Proxy to Backend: POST /api/admin/products
    return proxyRequest(request, "/api/admin/products");
}
