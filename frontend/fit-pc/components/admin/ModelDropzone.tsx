"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileBox, CheckCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ModelDropzoneProps {
    file: File | null;
    onFileSelect: (file: File | null) => void;
    disabled?: boolean;
    existingUrl?: string | null;
}

export default function ModelDropzone({ file, onFileSelect, disabled, existingUrl }: ModelDropzoneProps) {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        const droppedFile = acceptedFiles[0];
        if (!droppedFile) return;

        if (!droppedFile.name.toLowerCase().endsWith(".glb")) {
            toast.error("Invalid file type", { description: "Please upload a .glb file" });
            return;
        }

        onFileSelect(droppedFile);
        toast.success("File loaded", { description: droppedFile.name });
    }, [onFileSelect]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "model/gltf-binary": [".glb"],
        },
        maxFiles: 1,
        disabled,
    });

    const removeFile = (e: React.MouseEvent) => {
        e.stopPropagation();
        onFileSelect(null);
    };

    return (
        <div
            {...getRootProps()}
            className={cn(
                "relative border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer",
                isDragActive && "border-primary bg-primary/5",
                !isDragActive && !file && !existingUrl && "border-muted-foreground/25 hover:border-primary/50",
                (file || existingUrl) && "border-green-500/50 bg-green-500/5",
                disabled && "opacity-50 cursor-not-allowed"
            )}
        >
            <input {...getInputProps()} />

            {file ? (
                <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-green-500/10">
                        <FileBox className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={removeFile}
                        disabled={disabled}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            ) : existingUrl ? (
                <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-green-500/10">
                        <CheckCircle className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-green-600">Model uploaded</p>
                        <p className="text-sm text-muted-foreground truncate">
                            {existingUrl.split('/').pop()?.split('?')[0] || 'model.glb'}
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(existingUrl, '_blank');
                        }}
                        disabled={disabled}
                    >
                        <ExternalLink className="w-4 h-4" />
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                        <Upload className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                        <p className="font-medium">
                            {isDragActive ? "Drop the file here" : "Drag & drop your .glb file"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            or click to browse
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
