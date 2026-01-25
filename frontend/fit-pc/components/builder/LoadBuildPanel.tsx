"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Calendar, ArrowLeft } from "lucide-react";
import { SelectedComponent } from "./BuilderView";

interface Build {
    id: number;
    name: string;
    components?: any[];
    component_ids?: number[];
    total_price?: number;
    created_at: string;
    updated_at: string;
}

interface LoadBuildPanelProps {
    onLoadBuild: (buildId: number, buildName: string, components: SelectedComponent[]) => void;
    onBack: () => void;
}

export default function LoadBuildPanel({
    onLoadBuild,
    onBack,
}: LoadBuildPanelProps) {
    const [builds, setBuilds] = useState<Build[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingBuildId, setLoadingBuildId] = useState<number | null>(null);
    const [deletingBuildId, setDeletingBuildId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchBuilds();
    }, []);

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
            const data = responseData.data || responseData;
            const { build, components } = data;

            if (!build) {
                throw new Error("Build data not found in response");
            }

            const componentsList = components || build.components || [];

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
        <div className="space-y-4 overflow-auto h-full">
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={onBack}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <CardTitle className="text-lg">Load Build</CardTitle>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Select a saved build to load
                    </p>
                </CardHeader>
                <CardContent className="space-y-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-4">
                            <p className="text-sm text-destructive mb-4">{error}</p>
                            <Button variant="outline" size="sm" onClick={fetchBuilds}>
                                Try Again
                            </Button>
                        </div>
                    ) : builds.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-sm text-muted-foreground">
                                No saved builds yet. Start building and save your first configuration!
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {builds.map((build) => (
                                <div
                                    key={build.id}
                                    className="p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer group"
                                    onClick={() => handleLoadBuild(build.id)}
                                >
                                    {/* Build name and actions row */}
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <p className="font-medium text-sm leading-tight">
                                            {build.name}
                                        </p>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                            onClick={(e) => handleDeleteBuild(build.id, e)}
                                            disabled={deletingBuildId === build.id}
                                        >
                                            {deletingBuildId === build.id ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-3 h-3" />
                                            )}
                                        </Button>
                                    </div>

                                    {/* Metadata row */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            <span>{formatDate(build.updated_at)}</span>
                                            <span className="flex items-center gap-1">
                                                <span className="font-medium text-foreground">
                                                    {build.components?.length || build.component_ids?.length || 0}
                                                </span>
                                                parts
                                            </span>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="h-7 px-3 text-xs"
                                            disabled={loadingBuildId === build.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleLoadBuild(build.id);
                                            }}
                                        >
                                            {loadingBuildId === build.id ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                "Load"
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
