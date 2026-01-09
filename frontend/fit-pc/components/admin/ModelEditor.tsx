"use client";

import { Suspense, useState, useRef, useEffect, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, Grid, Html } from "@react-three/drei";
import { TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { GhostSocket } from "@/components/editor/GhostSocket";
import { useAnchorStore, AnchorType, AnchorDirection, Anchor, ConnectionAxis, ANCHOR_TYPE_INFO } from "@/store/useAnchorStore";
import { Plus, Trash2, Move, RotateCcw, Loader2, ArrowDown, ArrowUp, Eye, EyeOff, PanelTopClose } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getProxiedModelUrl } from "@/lib/model-proxy";

// Interface for removable parts
interface RemovablePart {
    name: string;
    displayName: string;
    visible: boolean;
}

interface ModelEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fileUrl: string;
    onSave: (anchors: Anchor[]) => void;
    initialAnchors?: Anchor[];
}

// Scale factor: models are in cm, we display at 1 unit = 10cm
const SCALE_FACTOR = 0.1;

function Model({
    url,
    onRemovablePartsFound,
    removablePartsVisibility,
}: {
    url: string;
    onRemovablePartsFound: (parts: RemovablePart[]) => void;
    removablePartsVisibility: Record<string, boolean>;
}) {
    const { scene } = useGLTF(getProxiedModelUrl(url));
    const groupRef = useRef<THREE.Group>(null);

    useEffect(() => {
        if (scene) {
            // Apply consistent scale (models in cm, SCALE_FACTOR converts to display units)
            scene.scale.setScalar(SCALE_FACTOR);

            // Find removable parts
            const parts: RemovablePart[] = [];
            scene.traverse((child) => {
                if (child instanceof THREE.Mesh && child.name.startsWith("Part_Removable_")) {
                    const displayName = child.name
                        .replace("Part_Removable_", "")
                        .replace(/_/g, " ");
                    parts.push({
                        name: child.name,
                        displayName,
                        visible: true,
                    });
                }
            });

            if (parts.length > 0) {
                onRemovablePartsFound(parts);
            }
        }
    }, [scene, onRemovablePartsFound]);

    // Apply visibility changes
    useEffect(() => {
        if (scene) {
            scene.traverse((child) => {
                if (child instanceof THREE.Mesh && child.name.startsWith("Part_Removable_")) {
                    const visibility = removablePartsVisibility[child.name];
                    if (visibility !== undefined) {
                        child.visible = visibility;
                    }
                }
            });
        }
    }, [scene, removablePartsVisibility]);

    return <primitive ref={groupRef} object={scene} />;
}

function AnchorMarker({
    anchor,
    isSelected,
    onSelect,
    onUpdate,
    transformMode,
}: {
    anchor: Anchor;
    isSelected: boolean;
    onSelect: () => void;
    onUpdate: (position: [number, number, number], rotation: [number, number, number]) => void;
    transformMode: 'translate' | 'rotate';
}) {
    const groupRef = useRef<THREE.Group>(null);
    const transformRef = useRef<any>(null);

    // Scale anchor position to match model scale
    const scaledPosition: [number, number, number] = [
        anchor.position[0] * SCALE_FACTOR,
        anchor.position[1] * SCALE_FACTOR,
        anchor.position[2] * SCALE_FACTOR,
    ];

    useEffect(() => {
        if (transformRef.current && groupRef.current) {
            const controls = transformRef.current;

            const handleDraggingChanged = (event: any) => {
                if (!event.value && groupRef.current) {
                    // Dragging ended - convert back to original scale for storage
                    const pos = groupRef.current.position;
                    const rot = groupRef.current.rotation;
                    onUpdate(
                        [pos.x / SCALE_FACTOR, pos.y / SCALE_FACTOR, pos.z / SCALE_FACTOR],
                        [rot.x, rot.y, rot.z]
                    );
                }
            };

            controls.addEventListener("dragging-changed", handleDraggingChanged);

            return () => {
                controls.removeEventListener("dragging-changed", handleDraggingChanged);
            };
        }
    }, [onUpdate, transformRef.current, groupRef.current]);

    return (
        <>
            <group
                ref={groupRef}
                position={scaledPosition}
                rotation={anchor.rotation}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect();
                }}
                scale={SCALE_FACTOR}
            >
                <GhostSocket
                    type={anchor.type}
                    isSelected={isSelected}
                    direction={anchor.direction}
                    connectionAxis={anchor.connectionAxis}
                />
            </group>
            {isSelected && groupRef.current && (
                <TransformControls
                    ref={transformRef}
                    object={groupRef.current}
                    mode={transformMode}
                    size={0.5}
                    onMouseDown={(e) => e.stopPropagation()}
                />
            )}
        </>
    );
}

function Scene({
    fileUrl,
    transformMode,
    onRemovablePartsFound,
    removablePartsVisibility,
}: {
    fileUrl: string;
    transformMode: 'translate' | 'rotate';
    onRemovablePartsFound: (parts: RemovablePart[]) => void;
    removablePartsVisibility: Record<string, boolean>;
}) {
    const { anchors, selectedAnchorId, selectAnchor, updateAnchor } = useAnchorStore();

    // Deselect anchor when clicking on background
    const handleBackgroundClick = () => {
        selectAnchor(null);
    };

    return (
        <>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <Environment preset="studio" />

            {/* Invisible plane for background clicks */}
            <mesh
                position={[0, 0, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                onClick={handleBackgroundClick}
                visible={false}
            >
                <planeGeometry args={[1000, 1000]} />
            </mesh>

            <Suspense fallback={
                <Html center>
                    <div className="flex items-center gap-2 text-white">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading model...
                    </div>
                </Html>
            }>
                <Model
                    url={fileUrl}
                    onRemovablePartsFound={onRemovablePartsFound}
                    removablePartsVisibility={removablePartsVisibility}
                />
            </Suspense>

            {anchors.map((anchor) => (
                <AnchorMarker
                    key={anchor.id}
                    anchor={anchor}
                    isSelected={selectedAnchorId === anchor.id}
                    onSelect={() => selectAnchor(anchor.id)}
                    onUpdate={(position, rotation) => updateAnchor(anchor.id, { position, rotation })}
                    transformMode={transformMode}
                />
            ))}

            <Grid
                infiniteGrid
                fadeDistance={50}
                fadeStrength={5}
                cellSize={1}
                sectionSize={5}
                cellColor="#6b7280"
                sectionColor="#374151"
            />

            <OrbitControls makeDefault />
        </>
    );
}

// Categorize anchor types for better UX
const anchorTypesByCategory = {
    "Motherboard Slots": [
        { value: "cpu_socket" as const, label: ANCHOR_TYPE_INFO.cpu_socket.label },
        { value: "ram_slot" as const, label: ANCHOR_TYPE_INFO.ram_slot.label },
        { value: "pcie_x16" as const, label: ANCHOR_TYPE_INFO.pcie_x16.label },
        { value: "pcie_x4" as const, label: ANCHOR_TYPE_INFO.pcie_x4.label },
        { value: "pcie_x1" as const, label: ANCHOR_TYPE_INFO.pcie_x1.label },
        { value: "m2_slot" as const, label: ANCHOR_TYPE_INFO.m2_slot.label },
        { value: "sata_port" as const, label: ANCHOR_TYPE_INFO.sata_port.label },
        { value: "cooler_plate" as const, label: ANCHOR_TYPE_INFO.cooler_plate.label },
    ],
    "Case Mounts": [
        { value: "mobo_mount_area" as const, label: ANCHOR_TYPE_INFO.mobo_mount_area.label },
        { value: "psu_bay" as const, label: ANCHOR_TYPE_INFO.psu_bay.label },
        { value: "fan_mount_120" as const, label: ANCHOR_TYPE_INFO.fan_mount_120.label },
        { value: "fan_mount_140" as const, label: ANCHOR_TYPE_INFO.fan_mount_140.label },
        { value: "drive_bay_25" as const, label: ANCHOR_TYPE_INFO.drive_bay_25.label },
        { value: "drive_bay_35" as const, label: ANCHOR_TYPE_INFO.drive_bay_35.label },
    ],
    "Component Connectors": [
        { value: "cpu_bottom" as const, label: ANCHOR_TYPE_INFO.cpu_bottom.label },
        { value: "cooler_base" as const, label: ANCHOR_TYPE_INFO.cooler_base.label },
        { value: "ram_edge" as const, label: ANCHOR_TYPE_INFO.ram_edge.label },
        { value: "pcie_edge" as const, label: ANCHOR_TYPE_INFO.pcie_edge.label },
        { value: "m2_edge" as const, label: ANCHOR_TYPE_INFO.m2_edge.label },
        { value: "sata_plug" as const, label: ANCHOR_TYPE_INFO.sata_plug.label },
        { value: "mobo_backplate" as const, label: ANCHOR_TYPE_INFO.mobo_backplate.label },
        { value: "psu_mount" as const, label: ANCHOR_TYPE_INFO.psu_mount.label },
        { value: "fan_mount" as const, label: ANCHOR_TYPE_INFO.fan_mount.label },
        { value: "drive_mount" as const, label: ANCHOR_TYPE_INFO.drive_mount.label },
    ],
};

const connectionAxisOptions: { value: ConnectionAxis; label: string; icon: string }[] = [
    { value: 'Y_NEG', label: 'Down (↓)', icon: '↓' },
    { value: 'Y_POS', label: 'Up (↑)', icon: '↑' },
    { value: 'Z_NEG', label: 'Back (←)', icon: '←' },
    { value: 'Z_POS', label: 'Forward (→)', icon: '→' },
    { value: 'X_NEG', label: 'Left (←)', icon: '←' },
    { value: 'X_POS', label: 'Right (→)', icon: '→' },
];

export default function ModelEditor({
    open,
    onOpenChange,
    fileUrl,
    onSave,
    initialAnchors = [],
}: ModelEditorProps) {
    const [selectedType, setSelectedType] = useState<AnchorType>("cpu_socket");
    const [transformMode, setTransformMode] = useState<'translate' | 'rotate'>('translate');
    const { anchors, addAnchor, duplicateAnchor, removeAnchor, selectedAnchorId, selectAnchor, setAnchors, clearAnchors, updateAnchor } = useAnchorStore();

    // Removable parts state
    const [removableParts, setRemovableParts] = useState<RemovablePart[]>([]);
    const [removablePartsVisibility, setRemovablePartsVisibility] = useState<Record<string, boolean>>({});

    const handleRemovablePartsFound = useCallback((parts: RemovablePart[]) => {
        setRemovableParts(parts);
        const visibility: Record<string, boolean> = {};
        parts.forEach((part) => {
            visibility[part.name] = true;
        });
        setRemovablePartsVisibility(visibility);
    }, []);

    const togglePart = useCallback((partName: string) => {
        setRemovablePartsVisibility((prev) => ({
            ...prev,
            [partName]: !prev[partName],
        }));
    }, []);

    const toggleAllParts = useCallback((visible: boolean) => {
        setRemovablePartsVisibility((prev) => {
            const updated: Record<string, boolean> = {};
            Object.keys(prev).forEach((key) => {
                updated[key] = visible;
            });
            return updated;
        });
    }, []);

    // Get selected anchor for editing
    const selectedAnchor = anchors.find(a => a.id === selectedAnchorId);

    // Initialize anchors when opening
    useEffect(() => {
        if (open) {
            if (initialAnchors.length > 0) {
                setAnchors(initialAnchors);
            } else {
                clearAnchors();
            }
            // Reset removable parts state when opening
            setRemovableParts([]);
            setRemovablePartsVisibility({});
        }
    }, [open, initialAnchors, setAnchors, clearAnchors]);

    const handleAddAnchor = () => {
        addAnchor(selectedType);
    };

    const handleDuplicateSelected = () => {
        if (selectedAnchorId) {
            duplicateAnchor(selectedAnchorId);
        }
    };

    const handleRemoveSelected = () => {
        if (selectedAnchorId) {
            removeAnchor(selectedAnchorId);
        }
    };

    const handleSave = () => {
        onSave(anchors);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!max-w-[95vw] !w-[1400px] h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>3D Model Editor</DialogTitle>
                    <DialogDescription>
                        Add anchor points for component connections. Click on anchors to select, then drag to position.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-4 flex-1 min-h-0">
                    {/* Canvas */}
                    <div className="relative flex-1 bg-gray-900 rounded-lg overflow-hidden">
                        {/* Removable Parts Panel Overlay */}
                        {removableParts.length > 0 && (
                            <div className="absolute top-4 left-4 z-10 bg-background/90 backdrop-blur-sm rounded-lg border shadow-lg p-3 space-y-2">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-sm font-medium flex items-center gap-2">
                                        <PanelTopClose className="h-4 w-4" />
                                        Case Panels
                                    </span>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-xs h-6 px-2"
                                            onClick={() => toggleAllParts(true)}
                                        >
                                            Show All
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-xs h-6 px-2"
                                            onClick={() => toggleAllParts(false)}
                                        >
                                            Hide All
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    {removableParts.map((part) => (
                                        <button
                                            key={part.name}
                                            onClick={() => togglePart(part.name)}
                                            className="flex items-center gap-2 w-full px-2 py-1 text-sm rounded hover:bg-accent transition-colors"
                                        >
                                            {removablePartsVisibility[part.name] ? (
                                                <Eye className="h-3 w-3 text-green-500" />
                                            ) : (
                                                <EyeOff className="h-3 w-3 text-muted-foreground" />
                                            )}
                                            <span className={removablePartsVisibility[part.name] ? "" : "text-muted-foreground"}>
                                                {part.displayName}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Canvas camera={{ position: [15, 15, 15], fov: 50 }}>
                            <Scene
                                fileUrl={fileUrl}
                                transformMode={transformMode}
                                onRemovablePartsFound={handleRemovablePartsFound}
                                removablePartsVisibility={removablePartsVisibility}
                            />
                        </Canvas>
                    </div>

                    {/* Sidebar */}
                    <div className="w-72 flex flex-col gap-4">
                        {/* Transform Mode Toggle */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Transform Mode</label>
                            <div className="flex gap-2">
                                <Button
                                    variant={transformMode === 'translate' ? 'default' : 'outline'}
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => setTransformMode('translate')}
                                >
                                    <Move className="w-4 h-4 mr-1" /> Move
                                </Button>
                                <Button
                                    variant={transformMode === 'rotate' ? 'default' : 'outline'}
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => setTransformMode('rotate')}
                                >
                                    <RotateCcw className="w-4 h-4 mr-1" /> Rotate
                                </Button>
                            </div>
                        </div>

                        {/* Add Anchor */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Add Anchor Point</label>
                            <div className="flex gap-2">
                                <Select value={selectedType} onValueChange={(v) => setSelectedType(v as AnchorType)}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className="max-h-[400px]">
                                        {Object.entries(anchorTypesByCategory).map(([category, types]) => (
                                            <div key={category}>
                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                                    {category}
                                                </div>
                                                {types.map((type) => (
                                                    <SelectItem key={type.value} value={type.value}>
                                                        {type.label}
                                                    </SelectItem>
                                                ))}
                                            </div>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button size="icon" onClick={handleAddAnchor}>
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Selected Anchor Editor */}
                        {selectedAnchor && (
                            <div className="space-y-3 p-3 bg-muted rounded-lg border border-primary">
                                <label className="text-sm font-medium">Edit Selected Anchor</label>

                                {/* Label */}
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Label</label>
                                    <Input
                                        value={selectedAnchor.label}
                                        onChange={(e) => updateAnchor(selectedAnchor.id, { label: e.target.value })}
                                        placeholder="Anchor name..."
                                        className="h-8"
                                    />
                                </div>

                                {/* Connection Axis */}
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Connection Axis</label>
                                    <Select
                                        value={selectedAnchor.connectionAxis}
                                        onValueChange={(v) => updateAnchor(selectedAnchor.id, { connectionAxis: v as ConnectionAxis })}
                                    >
                                        <SelectTrigger className="h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent position="popper">
                                            {connectionAxisOptions.map((axis) => (
                                                <SelectItem key={axis.value} value={axis.value}>
                                                    {axis.icon} {axis.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Arrow shows component insertion direction
                                    </p>
                                </div>

                                {/* Direction */}
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground">Direction</label>
                                    <div className="flex gap-2">
                                        <Button
                                            variant={selectedAnchor.direction === 'input' ? 'default' : 'outline'}
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => updateAnchor(selectedAnchor.id, { direction: 'input' })}
                                        >
                                            <ArrowDown className="w-3 h-3 mr-1 text-green-500" /> Input
                                        </Button>
                                        <Button
                                            variant={selectedAnchor.direction === 'output' ? 'default' : 'outline'}
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => updateAnchor(selectedAnchor.id, { direction: 'output' })}
                                        >
                                            <ArrowUp className="w-3 h-3 mr-1 text-red-500" /> Output
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {selectedAnchor.direction === 'input'
                                            ? '↓ Component connects INTO this point'
                                            : '↑ This slot RECEIVES a component'}
                                    </p>
                                </div>

                                {/* Duplicate/Delete Actions */}
                                <div className="flex gap-2 pt-2 border-t">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={handleDuplicateSelected}
                                    >
                                        <Plus className="w-3 h-3 mr-1" /> Duplicate
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="flex-1"
                                        onClick={handleRemoveSelected}
                                    >
                                        <Trash2 className="w-3 h-3 mr-1" /> Delete
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Anchors List */}
                        <div className="flex-1 space-y-2 overflow-auto">
                            <label className="text-sm font-medium">Anchor Points ({anchors.length})</label>
                            <div className="space-y-1">
                                {anchors.map((anchor, index) => (
                                    <div
                                        key={anchor.id}
                                        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${selectedAnchorId === anchor.id
                                            ? "bg-primary/10 border border-primary"
                                            : "bg-muted hover:bg-muted/80"
                                            }`}
                                        onClick={() => selectAnchor(anchor.id)}
                                    >
                                        <span className="text-xs text-muted-foreground w-4">{index + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm truncate">{anchor.label}</p>
                                            <div className="flex items-center gap-1">
                                                <Badge variant="secondary" className="text-xs px-1 py-0">
                                                    {anchor.type}
                                                </Badge>
                                                <Badge
                                                    variant={anchor.direction === 'input' ? 'default' : 'outline'}
                                                    className={`text-xs px-1 py-0 ${anchor.direction === 'input' ? 'bg-green-600' : 'bg-red-600 text-white'}`}
                                                >
                                                    {anchor.direction === 'input' ? '↓ in' : '↑ out'}
                                                </Badge>
                                            </div>
                                        </div>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeAnchor(anchor.id);
                                            }}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ))}
                                {anchors.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        No anchors added yet
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Controls hint */}
                        <div className="text-xs text-muted-foreground space-y-1 border-t pt-4">
                            <p><Move className="w-3 h-3 inline mr-1" /> Move mode: drag to position</p>
                            <p><RotateCcw className="w-3 h-3 inline mr-1" /> Rotate mode: drag to rotate</p>
                            <p className="text-green-500">↓ Input = component goes IN</p>
                            <p className="text-red-500">↑ Output = slot accepts component</p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>
                        Save Anchors ({anchors.length})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
