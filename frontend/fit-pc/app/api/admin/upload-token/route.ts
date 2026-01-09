import { proxyRequest } from "@/lib/api-proxy";

export async function GET(request: Request) {
    return proxyRequest(request, "/api/admin/upload-token");
}
