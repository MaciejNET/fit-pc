"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Search, AlertCircle, Minus, Plus } from "lucide-react";
import { BuildStep, SelectedComponent, BuildState } from "./BuilderView";

interface ComponentSelectorProps {
    currentStep: BuildStep;
    selectedComponent: SelectedComponent | null;
    buildState: BuildState;
    onSelect: (component: SelectedComponent) => void;
    onRemove: () => void;
    onSkip: () => void;
    maxRamSlots?: number;
    onUpdateRamQuantity?: (quantity: number) => void;
}

interface Product {
    id: string;
    name: string;
    category: string;
    price: number;
    sku: string;
    model_url?: string;
    anchor_points?: any[];
    technical_specs?: Record<string, any>;
}

export default function ComponentSelector({
    currentStep,
    selectedComponent,
    buildState,
    onSelect,
    onRemove,
    onSkip,
    maxRamSlots = 4,
    onUpdateRamQuantity,
}: ComponentSelectorProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    // Fetch products for current category
    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams();
                params.set("category", currentStep.category);
                params.set("limit", "50");

                const response = await fetch(`/api/products?${params.toString()}`);
                if (!response.ok) throw new Error("Failed to fetch products");

                const data = await response.json();
                setProducts(data.data || []);
            } catch (err) {
                console.error("Error fetching products:", err);
                setError("Failed to load components");
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, [currentStep.category]);

    // Filter products by search
    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.sku.toLowerCase().includes(search.toLowerCase())
    );

    // Check compatibility (basic for now)
    const checkCompatibility = (product: Product): { compatible: boolean; reason?: string } => {
        // Motherboard -> Case: check form factor
        if (currentStep.category === "MOTHERBOARD" && buildState.case) {
            const caseSpecs = buildState.case.technical_specs;
            const moboFormFactor = product.technical_specs?.form_factor;
            if (caseSpecs?.supported_motherboards && moboFormFactor) {
                if (!caseSpecs.supported_motherboards.includes(moboFormFactor)) {
                    return { compatible: false, reason: `Case doesn't support ${moboFormFactor}` };
                }
            }
        }

        // CPU -> Motherboard: check socket
        if (currentStep.category === "CPU" && buildState.motherboard) {
            const moboSocket = buildState.motherboard.technical_specs?.socket;
            const cpuSocket = product.technical_specs?.socket;
            if (moboSocket && cpuSocket && moboSocket !== cpuSocket) {
                return { compatible: false, reason: `Socket mismatch (needs ${moboSocket})` };
            }
        }

        // RAM -> Motherboard: check RAM type
        if (currentStep.category === "RAM" && buildState.motherboard) {
            const moboRamType = buildState.motherboard.technical_specs?.ram_type;
            const ramType = product.technical_specs?.type;
            if (moboRamType && ramType && moboRamType !== ramType) {
                return { compatible: false, reason: `RAM type mismatch (needs ${moboRamType})` };
            }
        }

        // GPU -> Case: check length
        if (currentStep.category === "GPU" && buildState.case) {
            const maxGpuLength = buildState.case.technical_specs?.max_gpu_length_mm;
            const gpuLength = product.technical_specs?.length_mm;
            if (maxGpuLength && gpuLength && gpuLength > maxGpuLength) {
                return { compatible: false, reason: `GPU too long (max ${maxGpuLength}mm)` };
            }
        }

        // CPU Cooler -> Case: check height
        if (currentStep.category === "CPU_COOLER" && buildState.case) {
            const maxCoolerHeight = buildState.case.technical_specs?.max_cpu_cooler_height_mm;
            const coolerHeight = product.technical_specs?.height_mm;
            if (maxCoolerHeight && coolerHeight && coolerHeight > maxCoolerHeight) {
                return { compatible: false, reason: `Cooler too tall (max ${maxCoolerHeight}mm)` };
            }
        }

        return { compatible: true };
    };

    return (
        <Card className="flex flex-col overflow-hidden">
            <CardHeader className="border-b py-3">
                <CardTitle className="text-lg">Choose {currentStep.label}</CardTitle>
                {selectedComponent ? (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{selectedComponent.name}</p>
                            {currentStep.category === "RAM" ? (
                                <p className="text-xs text-muted-foreground">
                                    ${selectedComponent.price} × {selectedComponent.quantity || 1} = ${(selectedComponent.price * (selectedComponent.quantity || 1)).toFixed(2)}
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground">${selectedComponent.price}</p>
                            )}
                        </div>
                        {/* RAM Quantity Selector */}
                        {currentStep.category === "RAM" && onUpdateRamQuantity && (
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const current = selectedComponent.quantity || 1;
                                        if (current > 1) onUpdateRamQuantity(current - 1);
                                    }}
                                    disabled={(selectedComponent.quantity || 1) <= 1}
                                >
                                    <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center text-sm font-medium">
                                    {selectedComponent.quantity || 1}
                                </span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const current = selectedComponent.quantity || 1;
                                        if (current < maxRamSlots) onUpdateRamQuantity(current + 1);
                                    }}
                                    disabled={(selectedComponent.quantity || 1) >= maxRamSlots}
                                >
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        Select from available options
                    </p>
                )}
            </CardHeader>

            <div className="p-3 border-b">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            <CardContent className="flex-1 overflow-auto p-3 space-y-2">
                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-2 text-destructive py-4">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                    </div>
                )}

                {!loading && !error && filteredProducts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        No {currentStep.label.toLowerCase()} found
                    </div>
                )}

                {!loading && !error && filteredProducts.map(product => {
                    const { compatible, reason } = checkCompatibility(product);
                    const isSelected = selectedComponent?.id === product.id;

                    return (
                        <button
                            key={product.id}
                            onClick={() => onSelect({
                                id: product.id,
                                name: product.name,
                                category: product.category,
                                price: product.price,
                                model_url: product.model_url,
                                anchor_points: product.anchor_points,
                                technical_specs: product.technical_specs,
                                // Set default quantity for RAM
                                quantity: currentStep.category === "RAM" ? 1 : undefined,
                            })}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${isSelected
                                ? "border-primary bg-primary/10"
                                : !compatible
                                    ? "border-destructive/50 bg-destructive/5 opacity-60"
                                    : "border-border hover:bg-muted"
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-xs flex-shrink-0">
                                    {product.model_url ? "3D" : "N/A"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{product.name}</p>
                                    <p className="text-xs text-muted-foreground">{product.sku}</p>
                                    {!compatible && reason && (
                                        <p className="text-xs text-destructive mt-1">{reason}</p>
                                    )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="font-semibold text-sm">${product.price}</p>
                                    {!compatible && (
                                        <Badge variant="destructive" className="text-xs mt-1">
                                            Incompatible
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}

                {/* Skip button for optional steps */}
                {!currentStep.required && !selectedComponent && (
                    <Button
                        variant="outline"
                        className="w-full mt-4"
                        onClick={onSkip}
                    >
                        Skip (Optional)
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
