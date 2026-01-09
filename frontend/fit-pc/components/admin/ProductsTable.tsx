"use client";

import { useState, useEffect } from "react";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getPaginationRowModel,
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { MoreHorizontal, Edit, Trash2, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ProductValues } from "@/lib/validators/product";
import axios from "axios";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

// Extended type to include ID
export type Product = ProductValues & { id: string };

interface ProductsTableProps {
    data: Product[];
    pageCount: number;
}

export default function ProductsTable({ data, pageCount }: ProductsTableProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // Prevent hydration mismatch with Radix UI components
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    // Search State
    const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Debounced Search Handler
    const handleSearch = (term: string) => {
        setSearchValue(term);
        const params = new URLSearchParams(searchParams);
        if (term) {
            params.set("search", term);
        } else {
            params.delete("search");
        }
        params.set("page", "1"); // Reset to page 1 on search
        router.replace(`${pathname}?${params.toString()}`);
    };

    // Pagination Handler
    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams);
        params.set("page", newPage.toString());
        router.push(`${pathname}?${params.toString()}`);
    };

    const currentPage = Number(searchParams.get("page")) || 1;

    // Delete Action
    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            await axios.delete(`/api/admin/products/${deleteId}`);
            toast.success("Product deleted successfully");
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete product");
        } finally {
            setDeleteId(null);
        }
    }

    // Columns Configuration
    const columns: ColumnDef<Product>[] = [
        {
            accessorKey: "model_url",
            header: "Thumnail",
            cell: ({ row }) => {
                const url = row.original.model_url;
                // Placeholder for real image or 3D viewer thumbnail. 
                // Since we save GLB URL, we might not have a 2D image.
                // For now, just a placeholder icon or generic image.
                return (
                    <div className="h-10 w-10 bg-muted rounded-md flex items-center justify-center text-xs overflow-hidden">
                        {url ? "3D" : "N/A"}
                    </div>
                )
            }
        },
        {
            accessorKey: "name",
            header: "Name",
        },
        {
            accessorKey: "category",
            header: "Category",
            cell: ({ row }) => <Badge variant="secondary">{row.original.category}</Badge>
        },
        {
            accessorKey: "sku",
            header: "SKU",
        },
        {
            accessorKey: "price",
            header: "Price",
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("price"));
                const formatted = new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                }).format(amount);
                return <div className="font-medium">{formatted}</div>;
            },
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const product = row.original;
                if (!mounted) {
                    return (
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    );
                }
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                                onClick={() => navigator.clipboard.writeText(product.id)}
                            >
                                Copy ID
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link href={`/admin/${product.id}/edit`} className="flex items-center w-full cursor-pointer">
                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setDeleteId(product.id)}
                                className="text-red-600 focus:text-red-600"
                            >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        // Manual pagination since we're server-side
        manualPagination: true,
        pageCount: pageCount,
    });

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center justify-between">
                <Input
                    placeholder="Search products..."
                    value={searchValue}
                    onChange={(event) => handleSearch(event.target.value)}
                    className="max-w-sm"
                />
                <Button asChild>
                    <Link href="/admin/new">Add Product</Link>
                </Button>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                >
                    Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {pageCount || 1}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= (pageCount || 1)}
                >
                    Next
                </Button>
            </div>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the product from the servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
