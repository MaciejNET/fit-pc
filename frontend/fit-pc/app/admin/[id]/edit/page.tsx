import ProductForm from "@/components/admin/ProductForm";
import { ProductValues } from "@/lib/validators/product";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditProductPageProps {
    params: Promise<{
        id: string;
    }>;
}

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

async function getProduct(id: string, token: string | null): Promise<(ProductValues & { id: string }) | null> {
    try {
        const response = await fetch(
            `${BACKEND_URL}/api/admin/products/${id}`,
            {
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                cache: "no-store",
            }
        );

        if (!response.ok) {
            console.error("Failed to fetch product:", response.status);
            return null;
        }

        const product = await response.json();
        return product;
    } catch (error) {
        console.error("Error fetching product:", error);
        return null;
    }
}

export default async function EditProductPage({ params }: EditProductPageProps) {
    const { id } = await params;

    const { getToken } = await auth();
    const token = await getToken();

    const product = await getProduct(id, token);

    if (!product) {
        notFound();
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin">
                        <ChevronLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold tracking-tight">Edit Product</h1>
                    <p className="text-muted-foreground">
                        Update product details and technical specifications.
                    </p>
                </div>
            </div>
            <div className="mx-auto w-full max-w-4xl">
                <ProductForm initialData={product} />
            </div>
        </div>
    );
}
