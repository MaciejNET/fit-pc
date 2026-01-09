import { proxyRequest } from "@/lib/api-proxy";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return proxyRequest(request, `/api/admin/products/${id}`);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return proxyRequest(request, `/api/admin/products/${id}`);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return proxyRequest(request, `/api/admin/products/${id}`);
}
