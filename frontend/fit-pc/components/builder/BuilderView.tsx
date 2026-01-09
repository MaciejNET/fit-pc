"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronRight, Save, FolderOpen } from "lucide-react";
import ComponentSelector from "@/components/builder/ComponentSelector";
import BuilderCanvas from "@/components/builder/BuilderCanvas";
import SaveBuildDialog from "@/components/builder/SaveBuildDialog";
import LoadBuildDialog from "@/components/builder/LoadBuildDialog";

// Build steps in order
export const BUILD_STEPS = [
    { id: "case", label: "Case", category: "CASE", required: true },
    { id: "motherboard", label: "Motherboard", category: "MOTHERBOARD", required: true },
    { id: "cpu", label: "CPU", category: "CPU", required: true },
    { id: "cpu_cooler", label: "CPU Cooler", category: "CPU_COOLER", required: true },
    { id: "ram", label: "RAM", category: "RAM", required: true },
    { id: "gpu", label: "GPU", category: "GPU", required: false },
    { id: "storage", label: "Storage", category: "STORAGE", required: true },
    { id: "psu", label: "PSU", category: "PSU", required: true },
] as const;

export type BuildStep = typeof BUILD_STEPS[number];
export type BuildStepId = BuildStep["id"];

export interface SelectedComponent {
    id: string;
    name: string;
    category: string;
    price: number;
    model_url?: string;
    anchor_points?: any[];
    technical_specs?: Record<string, any>;
    quantity?: number; // For RAM modules
}

export interface BuildState {
    [key: string]: SelectedComponent | null;
}

export default function BuilderView() {
    const { isSignedIn } = useAuth();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [buildState, setBuildState] = useState<BuildState>({});

    // Save/Load state
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [loadDialogOpen, setLoadDialogOpen] = useState(false);
    const [currentBuildId, setCurrentBuildId] = useState<number | null>(null);
    const [currentBuildName, setCurrentBuildName] = useState<string | null>(null);

    const currentStep = BUILD_STEPS[currentStepIndex];
    const isStepComplete = (stepId: BuildStepId) => !!buildState[stepId];
    const canProceed = isStepComplete(currentStep.id) || !currentStep.required;

    const handleNext = () => {
        if (currentStepIndex < BUILD_STEPS.length - 1) {
            setCurrentStepIndex(currentStepIndex + 1);
        }
    };

    const handlePrevious = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(currentStepIndex - 1);
        }
    };

    const handleSelectComponent = (component: SelectedComponent) => {
        setBuildState(prev => ({
            ...prev,
            [currentStep.id]: component
        }));
    };

    const handleUpdateRamQuantity = (quantity: number) => {
        if (buildState.ram) {
            setBuildState(prev => ({
                ...prev,
                ram: { ...prev.ram!, quantity }
            }));
        }
    };

    // Get max RAM slots from motherboard anchors
    const getMaxRamSlots = (): number => {
        if (!buildState.motherboard?.anchor_points) return 4; // default
        const ramSlots = buildState.motherboard.anchor_points.filter(
            (anchor: any) => anchor.type === "ram_slot"
        );
        return ramSlots.length || 4;
    };

    const handleRemoveComponent = (stepId: string) => {
        setBuildState(prev => ({
            ...prev,
            [stepId]: null
        }));
    };

    const handleLoadBuild = (buildId: number, buildName: string, components: SelectedComponent[]) => {
        // Reset build state
        const newBuildState: BuildState = {};

        // Map components to build steps based on category (case-insensitive comparison)
        components.forEach(component => {
            const step = BUILD_STEPS.find(s =>
                s.category.toUpperCase() === component.category?.toUpperCase()
            );
            if (step) {
                newBuildState[step.id] = component;
            }
        });

        setBuildState(newBuildState);
        setCurrentBuildId(buildId);
        setCurrentBuildName(buildName);
        setCurrentStepIndex(0);
    };

    const handleSaveSuccess = (buildId: number, buildName: string) => {
        setCurrentBuildId(buildId);
        setCurrentBuildName(buildName);
    };

    const handleNewBuild = () => {
        setBuildState({});
        setCurrentBuildId(null);
        setCurrentBuildName(null);
        setCurrentStepIndex(0);
    };

    const totalPrice = Object.values(buildState).reduce(
        (sum, component) => {
            if (!component) return sum;
            // For RAM, multiply by quantity
            const quantity = component.quantity || 1;
            return sum + (component.price * quantity);
        },
        0
    );

    const completedCount = BUILD_STEPS.filter(step => isStepComplete(step.id)).length;

    // Get all selected components for 3D view
    const selectedComponents = Object.entries(buildState)
        .filter(([_, component]) => component !== null)
        .map(([stepId, component]) => ({ stepId, ...component! }));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_400px] gap-4 h-[calc(100vh-120px)]">
            {/* Left Sidebar - Build Steps */}
            <div className="space-y-4 overflow-auto">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Build Progress</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {completedCount} of {BUILD_STEPS.length} components
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {BUILD_STEPS.map((step, index) => {
                            const isComplete = isStepComplete(step.id);
                            const isCurrent = index === currentStepIndex;
                            const component = buildState[step.id];

                            return (
                                <button
                                    key={step.id}
                                    onClick={() => setCurrentStepIndex(index)}
                                    className={`w-full text-left p-3 rounded-lg border transition-colors ${isCurrent
                                        ? "border-primary bg-primary/10"
                                        : "border-border hover:bg-muted"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs ${isComplete
                                                ? "bg-green-500 text-white"
                                                : isCurrent
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted text-muted-foreground"
                                                }`}
                                        >
                                            {isComplete ? (
                                                <Check className="w-4 h-4" />
                                            ) : (
                                                <span>{index + 1}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm">{step.label}</p>
                                            {component && (
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {component.name}
                                                </p>
                                            )}
                                        </div>
                                        {!step.required && (
                                            <Badge variant="outline" className="text-xs">
                                                Optional
                                            </Badge>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Total Price</CardTitle>
                            {currentBuildName && (
                                <Badge variant="secondary" className="text-xs">
                                    {currentBuildName}
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-3xl font-bold">
                            ${totalPrice.toFixed(2)}
                        </p>

                        {isSignedIn && (
                            <div className="flex flex-col gap-2">
                                <Button
                                    onClick={() => setSaveDialogOpen(true)}
                                    disabled={completedCount === 0}
                                    className="w-full"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    {currentBuildId ? "Save Build" : "Save New Build"}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setLoadDialogOpen(true)}
                                    className="w-full"
                                >
                                    <FolderOpen className="w-4 h-4 mr-2" />
                                    Load Build
                                </Button>
                                {currentBuildId && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleNewBuild}
                                        className="w-full text-muted-foreground"
                                    >
                                        Start New Build
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Center - 3D View */}
            <Card className="flex flex-col overflow-hidden">
                <CardHeader className="border-b py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">3D Preview</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                {currentStep.label}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePrevious}
                                disabled={currentStepIndex === 0}
                            >
                                Previous
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleNext}
                                disabled={!canProceed || currentStepIndex === BUILD_STEPS.length - 1}
                            >
                                Next <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 p-0">
                    <BuilderCanvas
                        selectedComponents={selectedComponents}
                        currentStep={currentStep}
                    />
                </CardContent>
            </Card>

            {/* Right Sidebar - Component Selection */}
            <ComponentSelector
                currentStep={currentStep}
                selectedComponent={buildState[currentStep.id]}
                buildState={buildState}
                onSelect={handleSelectComponent}
                onRemove={() => handleRemoveComponent(currentStep.id)}
                onSkip={handleNext}
                maxRamSlots={getMaxRamSlots()}
                onUpdateRamQuantity={handleUpdateRamQuantity}
            />

            {/* Save/Load Dialogs */}
            <SaveBuildDialog
                open={saveDialogOpen}
                onOpenChange={setSaveDialogOpen}
                buildState={buildState}
                currentBuildId={currentBuildId}
                currentBuildName={currentBuildName}
                onSaveSuccess={handleSaveSuccess}
            />
            <LoadBuildDialog
                open={loadDialogOpen}
                onOpenChange={setLoadDialogOpen}
                onLoadBuild={handleLoadBuild}
            />
        </div>
    );
}
