import ProductForm from "@/components/admin/ProductForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AddProductPage() {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin">
                        <ChevronLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold tracking-tight">Add New Product</h1>
                    <p className="text-muted-foreground">
                        Create a new hardware product with dynamic technical specifications.
                    </p>
                </div>
            </div>
            <div className="mx-auto w-full max-w-4xl">
                <ProductForm />
            </div>
        </div>
    );
}
