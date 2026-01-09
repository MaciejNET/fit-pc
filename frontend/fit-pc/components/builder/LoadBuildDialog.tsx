"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, FolderOpen, Trash2, Calendar } from "lucide-react";
import { SelectedComponent } from "./BuilderView";

interface Build {
    id: number;
    name: string;
    components?: any[];
    component_ids?: number[]; // Legacy support
    total_price?: number;
    created_at: string;
    updated_at: string;
}

interface LoadBuildDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLoadBuild: (buildId: number, buildName: string, components: SelectedComponent[]) => void;
}

export default function LoadBuildDialog({
    open,
    onOpenChange,
    onLoadBuild,
}: LoadBuildDialogProps) {
    const [builds, setBuilds] = useState<Build[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingBuildId, setLoadingBuildId] = useState<number | null>(null);
    const [deletingBuildId, setDeletingBuildId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            fetchBuilds();
        }
    }, [open]);

    const fetchBuilds = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/builds");
            if (!response.ok) {
                throw new Error("Failed to fetch builds");
            }

            const data = await response.json();
            setBuilds(data.data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load builds");
        } finally {
            setLoading(false);
        }
    };

    const handleLoadBuild = async (buildId: number) => {
        setLoadingBuildId(buildId);
        setError(null);

        try {
            const response = await fetch(`/api/builds/${buildId}`);
            if (!response.ok) {
                throw new Error("Failed to load build");
            }

            const responseData = await response.json();
            // Backend returns { data: { build, components, total_price } }
            const data = responseData.data || responseData;
            const { build, components } = data;

            if (!build) {
                throw new Error("Build data not found in response");
            }

            // Components can come from data.components or build.components (new schema)
            const componentsList = components || build.components || [];

            // Transform backend components to SelectedComponent format
            const selectedComponents: SelectedComponent[] = componentsList.map((c: any) => ({
                id: String(c.id),
                name: c.name,
                category: c.category,
                price: c.price,
                model_url: c.model_url,
                anchor_points: c.anchor_points,
                technical_specs: c.technical_specs,
                quantity: c.quantity,
            }));

            onLoadBuild(build.id, build.name, selectedComponents);
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load build");
        } finally {
            setLoadingBuildId(null);
        }
    };

    const handleDeleteBuild = async (buildId: number, e: React.MouseEvent) => {
        e.stopPropagation();

        if (!confirm("Are you sure you want to delete this build?")) {
            return;
        }

        setDeletingBuildId(buildId);
        setError(null);

        try {
            const response = await fetch(`/api/builds/${buildId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error("Failed to delete build");
            }

            setBuilds(builds.filter(b => b.id !== buildId));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete build");
        } finally {
            setDeletingBuildId(null);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Load Build</DialogTitle>
                    <DialogDescription>
                        Select a saved build to load into the editor.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-8">
                            <p className="text-sm text-destructive mb-4">{error}</p>
                            <Button variant="outline" size="sm" onClick={fetchBuilds}>
                                Try Again
                            </Button>
                        </div>
                    ) : builds.length === 0 ? (
                        <div className="text-center py-8">
                            <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-sm text-muted-foreground">
                                No saved builds yet. Start building and save your first configuration!
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[400px] overflow-auto">
                            {builds.map((build) => (
                                <div
                                    key={build.id}
                                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors cursor-pointer"
                                    onClick={() => handleLoadBuild(build.id)}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{build.name}</p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Calendar className="w-3 h-3" />
                                            <span>{formatDate(build.updated_at)}</span>
                                            <span>•</span>
                                            <span>{build.components?.length || build.component_ids?.length || 0} components</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 ml-4">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={(e) => handleDeleteBuild(build.id, e)}
                                            disabled={deletingBuildId === build.id}
                                        >
                                            {deletingBuildId === build.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </Button>

                                        <Button
                                            size="sm"
                                            disabled={loadingBuildId === build.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleLoadBuild(build.id);
                                            }}
                                        >
                                            {loadingBuildId === build.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                "Load"
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
