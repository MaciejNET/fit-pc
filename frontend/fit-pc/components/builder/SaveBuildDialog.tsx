"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { BuildState } from "./BuilderView";

interface SaveBuildDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildState: BuildState;
    currentBuildId: number | null;
    currentBuildName: string | null;
    onSaveSuccess: (buildId: number, buildName: string) => void;
}

export default function SaveBuildDialog({
    open,
    onOpenChange,
    buildState,
    currentBuildId,
    currentBuildName,
    onSaveSuccess,
}: SaveBuildDialogProps) {
    const [name, setName] = useState(currentBuildName || "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async (saveAsNew: boolean = false) => {
        if (!name.trim()) {
            setError("Please enter a build name");
            return;
        }

        // Extract full components from buildState (not just IDs)
        const components = Object.values(buildState)
            .filter((c): c is NonNullable<typeof c> => c !== null)
            .map(c => ({
                id: parseInt(c.id),
                name: c.name,
                category: c.category,
                price: c.price,
                model_url: c.model_url || "",
                technical_specs: c.technical_specs || {},
                anchor_points: c.anchor_points || [],
                quantity: c.quantity || 1,
            }));

        if (components.length === 0) {
            setError("Please select at least one component");
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const isUpdate = currentBuildId && !saveAsNew;
            const url = isUpdate ? `/api/builds/${currentBuildId}` : "/api/builds";
            const method = isUpdate ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    components: components,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to save build");
            }

            const data = await response.json();
            const savedBuild = data.data || data;

            onSaveSuccess(savedBuild.id, name.trim());
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save build");
        } finally {
            setSaving(false);
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (newOpen) {
            setName(currentBuildName || "");
            setError(null);
        }
        onOpenChange(newOpen);
    };

    const componentCount = Object.values(buildState).filter(c => c !== null).length;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {currentBuildId ? "Save Build" : "Save New Build"}
                    </DialogTitle>
                    <DialogDescription>
                        Save your current PC build configuration ({componentCount} components selected).
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="build-name">Build Name</Label>
                        <Input
                            id="build-name"
                            placeholder="My Gaming PC"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSave();
                            }}
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    {currentBuildId && (
                        <Button
                            variant="outline"
                            onClick={() => handleSave(true)}
                            disabled={saving}
                        >
                            Save as New
                        </Button>
                    )}
                    <Button onClick={() => handleSave(false)} disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                {currentBuildId ? "Update" : "Save"}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
