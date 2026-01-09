import ProductsTable, { Product } from "@/components/admin/ProductsTable";
import { auth } from "@clerk/nextjs/server";

interface AdminPageProps {
    searchParams: Promise<{
        page?: string;
        search?: string;
    }>;
}

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

async function getProducts(
    page: number,
    search: string,
    token: string | null
): Promise<{ data: Product[]; pageCount: number }> {
    try {
        const params = new URLSearchParams();
        params.set("page", page.toString());
        params.set("limit", "10");
        if (search) params.set("search", search);

        const response = await fetch(
            `${BACKEND_URL}/api/admin/products?${params.toString()}`,
            {
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                cache: "no-store",
            }
        );

        if (!response.ok) {
            console.error("Failed to fetch products:", response.status);
            return { data: [], pageCount: 0 };
        }

        const result = await response.json();

        // Backend returns { data: [...], total: number, page: number, limit: number }
        const total = result.total || 0;
        const limit = result.limit || 10;
        const pageCount = Math.ceil(total / limit);

        return {
            data: result.data || [],
            pageCount,
        };
    } catch (error) {
        console.error("Error fetching products:", error);
        return { data: [], pageCount: 0 };
    }
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
    const { page, search } = await searchParams;
    const currentPage = Number(page) || 1;
    const searchTerm = search || "";

    // Get auth token for server-side fetch
    const { getToken } = await auth();
    const token = await getToken();

    const { data, pageCount } = await getProducts(currentPage, searchTerm, token);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Products</h1>
                    <p className="text-muted-foreground">Manage your PC component catalog</p>
                </div>
            </div>
            <ProductsTable data={data} pageCount={pageCount} />
        </div>
    );
}
