"use client";

import { useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { Loader2, UploadCloud, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
    ProductSchema,
    ProductValues,
    ProductCategories,
    FormFactorEnum,
    RamTypeEnum,
    StorageTypeEnum,
} from "@/lib/validators/product";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import ModelDropzone from "./ModelDropzone";
import ModelEditor from "./ModelEditor";
import { Anchor, AnchorType, AnchorDirection, ConnectionAxis } from "@/store/useAnchorStore";

// Helper to get enum values - works with z.enum()
const getEnumValues = (zodEnum: any): string[] => {
    // Zod enums have .options array
    if (zodEnum?.options) {
        return zodEnum.options as string[];
    }
    // Fallback for .Values object (older pattern)
    if (zodEnum?.Values) {
        return Object.values(zodEnum.Values) as string[];
    }
    return [];
};

// Backend anchor format (matches backend schema)
interface BackendAnchorPoint {
    name: string;
    label: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    direction: string;
    connection_axis?: string;
    compatible_types?: string[];
}

interface ProductFormProps {
    initialData?: ProductValues & {
        id: string;
        anchor_points?: BackendAnchorPoint[];
    };
}

export default function ProductForm({ initialData }: ProductFormProps) {
    const router = useRouter();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New state for file handling
    const [modelFile, setModelFile] = useState<File | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);

    // Initialize anchors from initialData if editing
    const [anchors, setAnchors] = useState<Anchor[]>(() => {
        if (initialData?.anchor_points && initialData.anchor_points.length > 0) {
            return initialData.anchor_points.map((ap, index) => ({
                id: `anchor-${index}-${Date.now()}`,
                type: ap.name as AnchorType,  // Backend uses 'name', frontend uses 'type'
                label: ap.label || `Anchor ${index + 1}`,
                position: [ap.position.x, ap.position.y, ap.position.z] as [number, number, number],
                rotation: [ap.rotation.x, ap.rotation.y, ap.rotation.z] as [number, number, number],
                direction: (ap.direction || 'output') as AnchorDirection,
                connectionAxis: (ap.connection_axis || 'Y_NEG') as ConnectionAxis,
                compatibleWith: (ap.compatible_types || []) as AnchorType[],
            }));
        }
        return [];
    });

    // Create object URL for the 3D preview
    const modelPreviewUrl = useMemo(() => {
        if (modelFile) {
            return URL.createObjectURL(modelFile);
        }
        // Use proxy URL for existing models (bypasses CORS via Next.js)
        if (initialData?.model_url) {
            const blobName = initialData.model_url.split('/').pop()?.split('?')[0];
            if (blobName) {
                return `/api/admin/download-model?blob=${encodeURIComponent(blobName)}`;
            }
        }
        return null;
    }, [modelFile, initialData?.model_url]);

    const form = useForm<ProductValues>({
        resolver: zodResolver(ProductSchema as any),
        defaultValues: initialData || {
            category: "CPU",
            name: "",
            price: 0,
            sku: "",
            model_url: "",
        },
    });

    const {
        register,
        control,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = form;

    const category = watch("category");

    // Handle file selection - store locally, don't upload yet
    const handleFileSelect = (file: File | null) => {
        setModelFile(file);
        if (file) {
            // Open editor when file is loaded
            setEditorOpen(true);
        } else {
            setAnchors([]);
            setValue("model_url", "");
        }
    };

    // Handle anchor save from editor
    const handleAnchorsSave = (savedAnchors: Anchor[]) => {
        setAnchors(savedAnchors);
        toast.success(`Saved ${savedAnchors.length} anchor points`);
    };

    // Upload file to Azure Blob via Next.js proxy (avoids CORS)
    const uploadToAzure = async (file: File): Promise<string> => {
        const formData = new FormData();
        formData.append("file", file);

        const { data } = await axios.post<{ blob_url: string }>(
            "/api/admin/upload",
            formData,
            {
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: (progressEvent) => {
                    const percent = Math.round(
                        (progressEvent.loaded * 100) / (progressEvent.total || file.size)
                    );
                    setUploadProgress(percent);
                },
            }
        );

        return data.blob_url;
    };

    const onSubmit = async (values: ProductValues) => {
        try {
            setIsSubmitting(true);

            // If we have a new file, upload it first
            let modelUrl = values.model_url || "";
            if (modelFile) {
                setIsUploading(true);
                setUploadProgress(0);
                toast.info("Uploading 3D model...");

                try {
                    modelUrl = await uploadToAzure(modelFile);
                    toast.success("Model uploaded successfully");
                } catch (error) {
                    console.error("Upload failed:", error);
                    toast.error("Failed to upload 3D model");
                    return;
                } finally {
                    setIsUploading(false);
                }
            }

            // Prepare product data with model URL and anchors
            const productData = {
                ...values,
                model_url: modelUrl,
                // Include anchors in the product data
                // Convert frontend format to backend format
                anchor_points: anchors.map(a => ({
                    name: a.type,  // Backend uses 'name', frontend uses 'type'
                    label: a.label,
                    position: {
                        x: a.position[0],
                        y: a.position[1],
                        z: a.position[2],
                    },
                    rotation: {
                        x: a.rotation[0],
                        y: a.rotation[1],
                        z: a.rotation[2],
                    },
                    direction: a.direction,
                    connection_axis: a.connectionAxis,
                    compatible_types: a.compatibleWith || [],
                })),
            };

            if (initialData) {
                // Edit mode
                await axios.put(`/api/admin/products/${initialData.id}`, productData);
                toast.success("Product updated successfully");
            } else {
                // Create mode
                await axios.post("/api/admin/products", productData);
                toast.success("Product created successfully");
                form.reset();
                setModelFile(null);
                setAnchors([]);
            }
            router.refresh();
            router.push('/admin');
        } catch (error) {
            console.error(error);
            toast.error(initialData ? "Failed to update product" : "Failed to create product");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-4xl">

            {/* SECTION 1: BASIC INFO */}
            <Card>
                <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                    <CardDescription>General product details shared across all categories.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">

                    <Field>
                        <FieldLabel>Name</FieldLabel>
                        <Input {...register("name")} placeholder="e.g. Intel Core i9-13900K" />
                        <FieldError errors={[errors.name]} />
                    </Field>

                    <Field>
                        <FieldLabel>SKU</FieldLabel>
                        <Input {...register("sku")} placeholder="e.g. BX8071513900K" />
                        <FieldError errors={[errors.sku]} />
                    </Field>

                    <Field>
                        <FieldLabel>Price ($)</FieldLabel>
                        <Input type="number" step="0.01" {...register("price")} />
                        <FieldError errors={[errors.price]} />
                    </Field>

                    <Field>
                        <FieldLabel>Category</FieldLabel>
                        <Controller
                            control={control}
                            name="category"
                            render={({ field }) => (
                                <Select
                                    onValueChange={field.onChange}
                                    value={field.value}
                                    disabled={!!initialData}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select Category" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className="max-h-60">
                                        {ProductCategories.map((cat) => (
                                            <SelectItem key={cat} value={cat}>
                                                {cat}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        <FieldError errors={[errors.category]} />
                        {initialData && <FieldDescription>Category cannot be changed during edit.</FieldDescription>}
                    </Field>

                </CardContent>
            </Card>

            {/* SECTION 2: TECHNICAL SPECS */}
            <Card>
                <CardHeader>
                    <CardTitle>Technical Specifications</CardTitle>
                    <CardDescription>Specs specific to {category}.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">

                    {/* CPU Fields */}
                    {category === "CPU" && (
                        <>
                            <Field>
                                <FieldLabel>Socket</FieldLabel>
                                <Input {...register("technical_specs.socket")} placeholder="e.g. LGA1700" />
                                <FieldError errors={(errors as any).technical_specs?.socket ? [(errors as any).technical_specs?.socket] : []} />
                            </Field>
                            <Field>
                                <FieldLabel>TDP (Watts)</FieldLabel>
                                <Input type="number" {...register("technical_specs.tdp_watts")} />
                                <FieldError errors={(errors as any).technical_specs?.tdp_watts ? [(errors as any).technical_specs?.tdp_watts] : []} />
                            </Field>
                            <Field className="flex flex-row items-center gap-2 md:col-span-2">
                                <input type="checkbox" className="checkbox" {...register("technical_specs.integrated_graphics")} id="igpu" />
                                <FieldLabel htmlFor="igpu" className="mb-0">Integrated Graphics</FieldLabel>
                            </Field>
                        </>
                    )}

                    {/* CPU_COOLER Fields */}
                    {category === "CPU_COOLER" && (
                        <>
                            <Field>
                                <FieldLabel>Supported Sockets (comma-separated)</FieldLabel>
                                <Controller
                                    control={control}
                                    name="technical_specs.supported_sockets"
                                    render={({ field }) => (
                                        <Input
                                            placeholder="e.g. AM4, AM5, LGA1700"
                                            value={Array.isArray(field.value) ? field.value.join(', ') : (field.value || '')}
                                            onChange={(e) => {
                                                const socketsArray = e.target.value
                                                    .split(',')
                                                    .map(s => s.trim())
                                                    .filter(Boolean);
                                                field.onChange(socketsArray);
                                            }}
                                            onBlur={field.onBlur}
                                        />
                                    )}
                                />
                                <FieldError errors={(errors as any).technical_specs?.supported_sockets ? [(errors as any).technical_specs?.supported_sockets] : []} />
                            </Field>
                            <Field>
                                <FieldLabel>Height (mm)</FieldLabel>
                                <Input type="number" {...register("technical_specs.height_mm")} />
                                <FieldError errors={(errors as any).technical_specs?.height_mm ? [(errors as any).technical_specs?.height_mm] : []} />
                            </Field>
                            <Field>
                                <FieldLabel>TDP Rating (Watts)</FieldLabel>
                                <Input type="number" {...register("technical_specs.tdp_rating_watts")} />
                                <FieldError errors={(errors as any).technical_specs?.tdp_rating_watts ? [(errors as any).technical_specs?.tdp_rating_watts] : []} />
                            </Field>
                            <Field>
                                <FieldLabel>Fan Size (mm) - Optional</FieldLabel>
                                <Input type="number" {...register("technical_specs.fan_size_mm")} />
                                <FieldError errors={(errors as any).technical_specs?.fan_size_mm ? [(errors as any).technical_specs?.fan_size_mm] : []} />
                            </Field>
                        </>
                    )}

                    {/* MOTHERBOARD Fields */}
                    {category === "MOTHERBOARD" && (
                        <>
                            <Field>
                                <FieldLabel>Socket</FieldLabel>
                                <Input {...register("technical_specs.socket")} placeholder="e.g. LGA1700" />
                                <FieldError errors={(errors as any).technical_specs?.socket ? [(errors as any).technical_specs?.socket] : []} />
                            </Field>
                            <Field>
                                <FieldLabel>Form Factor</FieldLabel>
                                <Controller
                                    control={control}
                                    name="technical_specs.form_factor"
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                            <SelectTrigger><SelectValue placeholder="Select Form Factor" /></SelectTrigger>
                                            <SelectContent>
                                                {getEnumValues(FormFactorEnum).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </Field>
                            <Field>
                                <FieldLabel>RAM Type</FieldLabel>
                                <Controller
                                    control={control}
                                    name="technical_specs.ram_type"
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                            <SelectTrigger><SelectValue placeholder="Select RAM Type" /></SelectTrigger>
                                            <SelectContent>
                                                {getEnumValues(RamTypeEnum).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </Field>
                            <Field>
                                <FieldLabel>RAM Slots</FieldLabel>
                                <Input type="number" {...register("technical_specs.ram_slots")} />
                            </Field>
                            <Field>
                                <FieldLabel>M.2 Slots</FieldLabel>
                                <Input type="number" {...register("technical_specs.m2_slots")} />
                            </Field>
                        </>
                    )}

                    {/* GPU Fields */}
                    {category === "GPU" && (
                        <>
                            <Field>
                                <FieldLabel>Length (mm)</FieldLabel>
                                <Input type="number" {...register("technical_specs.length_mm")} />
                            </Field>
                            <Field>
                                <FieldLabel>TDP (Watts)</FieldLabel>
                                <Input type="number" {...register("technical_specs.tdp_watts")} />
                            </Field>
                            <Field>
                                <FieldLabel>VRAM (GB)</FieldLabel>
                                <Input type="number" {...register("technical_specs.vram_gb")} />
                            </Field>
                        </>
                    )}

                    {/* RAM Fields */}
                    {category === "RAM" && (
                        <>
                            <Field>
                                <FieldLabel>Type</FieldLabel>
                                <Controller
                                    control={control}
                                    name="technical_specs.type"
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                            <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                                            <SelectContent>
                                                {getEnumValues(RamTypeEnum).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </Field>
                            <Field>
                                <FieldLabel>Capacity (GB)</FieldLabel>
                                <Input type="number" {...register("technical_specs.capacity_gb")} />
                            </Field>
                            <Field>
                                <FieldLabel>Modules Count</FieldLabel>
                                <Input type="number" {...register("technical_specs.modules_count")} />
                            </Field>
                            <Field>
                                <FieldLabel>Speed (MHz)</FieldLabel>
                                <Input type="number" {...register("technical_specs.speed_mhz")} />
                            </Field>
                        </>
                    )}

                    {/* PSU Fields */}
                    {category === "PSU" && (
                        <>
                            <Field>
                                <FieldLabel>Wattage</FieldLabel>
                                <Input type="number" {...register("technical_specs.wattage")} />
                            </Field>
                            <Field>
                                <FieldLabel>Form Factor</FieldLabel>
                                <Input {...register("technical_specs.form_factor")} placeholder="e.g. ATX" />
                            </Field>
                        </>
                    )}

                    {/* STORAGE Fields */}
                    {category === "STORAGE" && (
                        <>
                            <Field>
                                <FieldLabel>Type</FieldLabel>
                                <Controller
                                    control={control}
                                    name="technical_specs.type"
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                            <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                                            <SelectContent>
                                                {getEnumValues(StorageTypeEnum).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </Field>
                            <Field>
                                <FieldLabel>Interface</FieldLabel>
                                <Input {...register("technical_specs.interface")} placeholder="e.g. NVMe PCIe 4.0" />
                            </Field>
                        </>
                    )}

                    {/* CASE Fields */}
                    {category === "CASE" && (
                        <>
                            <Field className="md:col-span-2">
                                <FieldLabel>Max GPU Length (mm)</FieldLabel>
                                <Input type="number" {...register("technical_specs.max_gpu_length_mm")} />
                            </Field>
                            <Field className="md:col-span-2">
                                <FieldLabel>Max CPU Cooler Height (mm)</FieldLabel>
                                <Input type="number" {...register("technical_specs.max_cpu_cooler_height_mm")} />
                            </Field>
                            <Field className="md:col-span-2">
                                <FieldLabel>Supported Motherboards (Check all that apply)</FieldLabel>
                                <div className="flex gap-4">
                                    {getEnumValues(FormFactorEnum).map((ff) => (
                                        <label key={ff} className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                value={ff}
                                                {...register("technical_specs.supported_motherboards")}
                                            />
                                            {ff}
                                        </label>
                                    ))}
                                </div>
                            </Field>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* SECTION 3: 3D MODEL UPLOAD */}
            <Card>
                <CardHeader>
                    <CardTitle>3D Model</CardTitle>
                    <CardDescription>Upload the .glb file for the 3D builder and configure anchor points.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Field>
                        <FieldLabel>Model File (.glb)</FieldLabel>
                        <ModelDropzone
                            file={modelFile}
                            onFileSelect={handleFileSelect}
                            disabled={isUploading || isSubmitting}
                            existingUrl={initialData?.model_url}
                        />
                        <FieldDescription>
                            {initialData?.model_url && !modelFile
                                ? "Drop a new file to replace the existing model."
                                : "Drag and drop your .glb file or click to browse. The file will be uploaded when you save the product."
                            }
                        </FieldDescription>
                    </Field>

                    {/* Show edit anchors button when file is loaded */}
                    {(modelFile || initialData?.model_url) && (
                        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                            <div className="flex-1">
                                <p className="font-medium">Anchor Points</p>
                                <p className="text-sm text-muted-foreground">
                                    {anchors.length > 0
                                        ? `${anchors.length} anchor point${anchors.length > 1 ? 's' : ''} configured`
                                        : 'No anchor points configured yet'}
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditorOpen(true)}
                                disabled={isUploading || isSubmitting}
                            >
                                <Pencil className="w-4 h-4 mr-2" />
                                {anchors.length > 0 ? 'Edit Anchors' : 'Add Anchors'}
                            </Button>
                        </div>
                    )}

                    {isUploading && (
                        <div className="flex items-center gap-3 p-4 bg-blue-500/10 rounded-lg text-blue-600">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <div className="flex-1">
                                <p className="font-medium">Uploading to Azure...</p>
                                <div className="w-full bg-blue-200 rounded-full h-2 mt-1">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            </div>
                            <span className="text-sm font-mono">{uploadProgress}%</span>
                        </div>
                    )}

                    <input type="hidden" {...register("model_url")} />
                    <FieldError errors={[errors.model_url]} />
                </CardContent>
            </Card>

            {/* 3D Model Editor Dialog */}
            {modelPreviewUrl && (
                <ModelEditor
                    open={editorOpen}
                    onOpenChange={setEditorOpen}
                    fileUrl={modelPreviewUrl}
                    onSave={handleAnchorsSave}
                    initialAnchors={anchors}
                />
            )}

            <div className="flex justify-end gap-4">
                <Button variant="outline" type="button" onClick={() => router.back()}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || isUploading}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {initialData ? "Update Product" : "Create Product"}
                </Button>
            </div>

        </form>
    );
}
