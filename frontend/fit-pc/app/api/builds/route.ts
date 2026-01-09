import { proxyRequest } from "@/lib/api-proxy";

export async function GET(request: Request) {
    return proxyRequest(request, "/api/user/builds");
}

export async function POST(request: Request) {
    return proxyRequest(request, "/api/user/builds");
}
