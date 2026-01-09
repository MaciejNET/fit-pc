"use client";

import { Suspense, useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, Html, useGLTF, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { Loader2, Eye, EyeOff, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { BuildStep, SelectedComponent } from "./BuilderView";
import { Button } from "@/components/ui/button";
import { getProxiedModelUrl } from "@/lib/model-proxy";
import { Anchor, AnchorType } from "@/store/useAnchorStore";

// Interface for removable parts
interface RemovablePart {
    name: string;
    displayName: string;
    visible: boolean;
}

interface BuilderCanvasProps {
    selectedComponents: (SelectedComponent & { stepId: string })[];
    currentStep: BuildStep;
}

// Scale factor: models are in cm, we display at 1 unit = 10cm for reasonable viewport
const SCALE_FACTOR = 0.1; // 10cm = 1 unit

// API anchor format (from backend)
interface ApiAnchor {
    name: string;
    label: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    direction: string;
    connection_axis: string;
    compatible_types: string[];
}

// Convert API anchor format to internal format
function convertApiAnchor(apiAnchor: ApiAnchor): Anchor {
    return {
        id: apiAnchor.label,
        type: apiAnchor.name as any,
        label: apiAnchor.label,
        position: [apiAnchor.position.x, apiAnchor.position.y, apiAnchor.position.z],
        rotation: [apiAnchor.rotation.x, apiAnchor.rotation.y, apiAnchor.rotation.z],
        direction: apiAnchor.direction as any,
        connectionAxis: apiAnchor.connection_axis as any,
        compatibleWith: apiAnchor.compatible_types as any[],
    };
}

// Convert array of API anchors
function convertApiAnchors(apiAnchors: any[]): Anchor[] {
    if (!apiAnchors || !Array.isArray(apiAnchors)) return [];
    return apiAnchors.map(convertApiAnchor);
}

// Case model with removable parts detection - consistent scaling
function CaseModel({
    component,
    position = new THREE.Vector3(0, 0, 0),
    onRemovablePartsFound,
    removablePartsVisibility,
}: {
    component: SelectedComponent & { stepId: string };
    position?: THREE.Vector3;
    onRemovablePartsFound: (parts: RemovablePart[]) => void;
    removablePartsVisibility: Record<string, boolean>;
}) {
    const groupRef = useRef<THREE.Group>(null);
    const { scene } = useGLTF(getProxiedModelUrl(component.model_url));
    const [partsFound, setPartsFound] = useState(false);

    // Clone and scale the scene immediately using useMemo
    const scaledScene = useMemo(() => {
        const cloned = scene.clone();
        cloned.scale.setScalar(SCALE_FACTOR);
        return cloned;
    }, [scene]);

    // Find removable parts only once
    useEffect(() => {
        if (scaledScene && !partsFound) {
            const parts: RemovablePart[] = [];
            scaledScene.traverse((child) => {
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
                setPartsFound(true);
            }
        }
    }, [scaledScene, partsFound, onRemovablePartsFound]);

    // Apply visibility changes
    useEffect(() => {
        if (scaledScene) {
            scaledScene.traverse((child) => {
                if (child instanceof THREE.Mesh && child.name.startsWith("Part_Removable_")) {
                    const visibility = removablePartsVisibility[child.name];
                    if (visibility !== undefined) {
                        child.visible = visibility;
                    }
                }
            });
        }
    }, [scaledScene, removablePartsVisibility]);

    return (
        <group ref={groupRef} position={position}>
            <primitive object={scaledScene} />
        </group>
    );
}

// Transform interface for position + rotation
interface ComponentTransform {
    position: THREE.Vector3;
    rotation: THREE.Euler;
}

// Component model loader - consistent scaling with rotation support
function ComponentModel({
    component,
    position = new THREE.Vector3(0, 0, 0),
    rotation = new THREE.Euler(0, 0, 0),
}: {
    component: SelectedComponent & { stepId: string };
    position?: THREE.Vector3;
    rotation?: THREE.Euler;
}) {
    // Don't render if no model URL
    if (!component.model_url) {
        return (
            <mesh position={position} rotation={rotation}>
                <boxGeometry args={[1, 0.2, 1]} />
                <meshStandardMaterial color="#666" transparent opacity={0.5} />
            </mesh>
        );
    }

    return (
        <Suspense fallback={
            <mesh position={position} rotation={rotation}>
                <boxGeometry args={[1, 0.2, 1]} />
                <meshStandardMaterial color="#888" wireframe />
            </mesh>
        }>
            <ModelLoader url={component.model_url} position={position} rotation={rotation} />
        </Suspense>
    );
}

function ModelLoader({ url, position, rotation }: { url: string; position: THREE.Vector3; rotation: THREE.Euler }) {
    const { scene } = useGLTF(getProxiedModelUrl(url));
    const groupRef = useRef<THREE.Group>(null);

    // Clone and scale the scene immediately using useMemo
    const scaledScene = useMemo(() => {
        const cloned = scene.clone();
        cloned.scale.setScalar(SCALE_FACTOR);
        return cloned;
    }, [scene]);

    return (
        <group ref={groupRef} position={position} rotation={rotation}>
            <primitive object={scaledScene} />
        </group>
    );
}

function Scene({
    selectedComponents,
    currentStep,
    onRemovablePartsFound,
    removablePartsVisibility,
}: BuilderCanvasProps & {
    onRemovablePartsFound: (parts: RemovablePart[]) => void;
    removablePartsVisibility: Record<string, boolean>;
}) {
    // Calculate positions AND rotations based on anchor matching
    const componentTransforms = useMemo(() => {
        const transforms: Record<string, ComponentTransform> = {};

        // Case is always at origin with no rotation
        const caseComponent = selectedComponents.find(c => c.stepId === "case");
        transforms["case"] = {
            position: new THREE.Vector3(0, 0, 0),
            rotation: new THREE.Euler(0, 0, 0)
        };

        // Motherboard position based on case mobo_mount_area anchor
        const moboComponent = selectedComponents.find(c => c.stepId === "motherboard");
        if (caseComponent && moboComponent) {
            const caseAnchors = convertApiAnchors(caseComponent.anchor_points || []);
            const moboAnchors = convertApiAnchors(moboComponent.anchor_points || []);

            // Find mobo_mount_area in case
            const mountArea = caseAnchors.find(a => a.type === "mobo_mount_area");
            // Find mobo_backplate in motherboard (if exists)
            const moboBackplate = moboAnchors.find(a => a.type === "mobo_backplate");

            if (mountArea) {
                // Position motherboard at the mount area
                const mountPos = new THREE.Vector3(
                    mountArea.position[0] * SCALE_FACTOR,
                    mountArea.position[1] * SCALE_FACTOR,
                    mountArea.position[2] * SCALE_FACTOR
                );

                // If mobo has backplate anchor, offset by that
                if (moboBackplate) {
                    mountPos.x -= moboBackplate.position[0] * SCALE_FACTOR;
                    mountPos.y -= moboBackplate.position[1] * SCALE_FACTOR;
                    mountPos.z -= moboBackplate.position[2] * SCALE_FACTOR;
                }

                // Use rotation from mount area anchor + correction for model orientation
                // Model is exported lying flat, so we add +90° (+π/2) on X axis to stand it up
                const mountRotation = new THREE.Euler(
                    mountArea.rotation[0] + Math.PI / 2,
                    mountArea.rotation[1],
                    mountArea.rotation[2]
                );

                transforms["motherboard"] = {
                    position: mountPos,
                    rotation: mountRotation
                };
            } else {
                // Fallback position
                transforms["motherboard"] = {
                    position: new THREE.Vector3(0, 1, 0),
                    rotation: new THREE.Euler(0, 0, 0)
                };
            }
        }

        // CPU position based on motherboard cpu_socket anchor
        const cpuComponent = selectedComponents.find(c => c.stepId === "cpu");
        if (moboComponent && cpuComponent) {
            const moboAnchors = convertApiAnchors(moboComponent.anchor_points || []);
            const cpuAnchors = convertApiAnchors(cpuComponent.anchor_points || []);

            const socket = moboAnchors.find(a => a.type === "cpu_socket");
            const cpuBottom = cpuAnchors.find(a => a.type === "cpu_bottom");

            if (socket) {
                const moboTransform = transforms["motherboard"] || { position: new THREE.Vector3(), rotation: new THREE.Euler() };

                // Calculate CPU position relative to motherboard with rotation
                const socketOffset = new THREE.Vector3(
                    socket.position[0] * SCALE_FACTOR,
                    socket.position[1] * SCALE_FACTOR,
                    socket.position[2] * SCALE_FACTOR
                );
                socketOffset.applyEuler(moboTransform.rotation);

                const cpuPos = moboTransform.position.clone().add(socketOffset);

                // Offset by CPU's bottom anchor if exists
                if (cpuBottom) {
                    const cpuOffset = new THREE.Vector3(
                        cpuBottom.position[0] * SCALE_FACTOR,
                        cpuBottom.position[1] * SCALE_FACTOR,
                        cpuBottom.position[2] * SCALE_FACTOR
                    );
                    cpuOffset.applyEuler(moboTransform.rotation);
                    cpuPos.sub(cpuOffset);
                }

                transforms["cpu"] = {
                    position: cpuPos,
                    rotation: moboTransform.rotation.clone()
                };
            } else {
                transforms["cpu"] = {
                    position: new THREE.Vector3(0, 1.5, 0),
                    rotation: new THREE.Euler(0, 0, 0)
                };
            }
        }

        // CPU Cooler position based on CPU cooler_plate
        const coolerComponent = selectedComponents.find(c => c.stepId === "cpu_cooler");
        if (cpuComponent && coolerComponent) {
            const cpuAnchors = convertApiAnchors(cpuComponent.anchor_points || []);
            const coolerAnchors = convertApiAnchors(coolerComponent.anchor_points || []);

            const coolerPlate = cpuAnchors.find(a => a.type === "cooler_plate");
            const coolerBase = coolerAnchors.find(a => a.type === "cooler_base");

            if (coolerPlate) {
                const cpuTransform = transforms["cpu"] || { position: new THREE.Vector3(), rotation: new THREE.Euler() };

                // Calculate cooler rotation first (CPU rotation + cooler_plate anchor rotation)
                const coolerRotation = new THREE.Euler(
                    cpuTransform.rotation.x + coolerPlate.rotation[0],
                    cpuTransform.rotation.y + coolerPlate.rotation[1],
                    cpuTransform.rotation.z + coolerPlate.rotation[2]
                );

                // Calculate cooler position - cooler_plate is in CPU's rotated local space
                const plateOffset = new THREE.Vector3(
                    coolerPlate.position[0] * SCALE_FACTOR,
                    coolerPlate.position[1] * SCALE_FACTOR,
                    coolerPlate.position[2] * SCALE_FACTOR
                );
                plateOffset.applyEuler(cpuTransform.rotation);

                const coolerPos = cpuTransform.position.clone().add(plateOffset);

                // Apply cooler_base offset - must be rotated by cooler's final rotation
                if (coolerBase) {
                    const baseOffset = new THREE.Vector3(
                        coolerBase.position[0] * SCALE_FACTOR,
                        coolerBase.position[1] * SCALE_FACTOR,
                        coolerBase.position[2] * SCALE_FACTOR
                    );
                    baseOffset.applyEuler(coolerRotation);
                    coolerPos.sub(baseOffset);
                }

                transforms["cpu_cooler"] = {
                    position: coolerPos,
                    rotation: coolerRotation
                };
            } else {
                const cpuTransform = transforms["cpu"] || { position: new THREE.Vector3(), rotation: new THREE.Euler() };
                transforms["cpu_cooler"] = {
                    position: new THREE.Vector3(cpuTransform.position.x, cpuTransform.position.y + 0.5, cpuTransform.position.z),
                    rotation: cpuTransform.rotation.clone()
                };
            }
        }

        // GPU position based on motherboard pcie_x16 anchor
        const gpuComponent = selectedComponents.find(c => c.stepId === "gpu");
        if (moboComponent && gpuComponent) {
            const moboAnchors = convertApiAnchors(moboComponent.anchor_points || []);
            const gpuAnchors = convertApiAnchors(gpuComponent.anchor_points || []);

            const pcie = moboAnchors.find(a => a.type === "pcie_x16");
            const pcieEdge = gpuAnchors.find(a => a.type === "pcie_edge");

            if (pcie) {
                const moboTransform = transforms["motherboard"] || { position: new THREE.Vector3(), rotation: new THREE.Euler() };

                const pcieOffset = new THREE.Vector3(
                    pcie.position[0] * SCALE_FACTOR,
                    pcie.position[1] * SCALE_FACTOR,
                    pcie.position[2] * SCALE_FACTOR
                );
                pcieOffset.applyEuler(moboTransform.rotation);

                const gpuPos = moboTransform.position.clone().add(pcieOffset);

                if (pcieEdge) {
                    const edgeOffset = new THREE.Vector3(
                        pcieEdge.position[0] * SCALE_FACTOR,
                        pcieEdge.position[1] * SCALE_FACTOR,
                        pcieEdge.position[2] * SCALE_FACTOR
                    );
                    edgeOffset.applyEuler(moboTransform.rotation);
                    gpuPos.sub(edgeOffset);
                }

                // GPU rotation from PCIe slot
                const gpuRotation = new THREE.Euler(
                    moboTransform.rotation.x + pcie.rotation[0],
                    moboTransform.rotation.y + pcie.rotation[1],
                    moboTransform.rotation.z + pcie.rotation[2]
                );

                transforms["gpu"] = {
                    position: gpuPos,
                    rotation: gpuRotation
                };
            } else {
                transforms["gpu"] = {
                    position: new THREE.Vector3(0, 0, 2),
                    rotation: new THREE.Euler(0, 0, 0)
                };
            }
        }

        // PSU position based on case psu_bay anchor
        const psuComponent = selectedComponents.find(c => c.stepId === "psu");
        if (caseComponent && psuComponent) {
            const caseAnchors = convertApiAnchors(caseComponent.anchor_points || []);
            const psuAnchors = convertApiAnchors(psuComponent.anchor_points || []);

            const psuBay = caseAnchors.find(a => a.type === "psu_bay");
            const psuMount = psuAnchors.find(a => a.type === "psu_mount");

            if (psuBay) {
                const psuPos = new THREE.Vector3(
                    psuBay.position[0] * SCALE_FACTOR,
                    psuBay.position[1] * SCALE_FACTOR,
                    psuBay.position[2] * SCALE_FACTOR
                );

                if (psuMount) {
                    psuPos.x -= psuMount.position[0] * SCALE_FACTOR;
                    psuPos.y -= psuMount.position[1] * SCALE_FACTOR;
                    psuPos.z -= psuMount.position[2] * SCALE_FACTOR;
                }

                const psuRotation = new THREE.Euler(
                    psuBay.rotation[0],
                    psuBay.rotation[1],
                    psuBay.rotation[2]
                );

                transforms["psu"] = {
                    position: psuPos,
                    rotation: psuRotation
                };
            } else {
                transforms["psu"] = {
                    position: new THREE.Vector3(0, -2, 0),
                    rotation: new THREE.Euler(0, 0, 0)
                };
            }
        }

        // Storage position based on M.2 slot or drive bays
        const storageComponent = selectedComponents.find(c => c.stepId === "storage");
        if (storageComponent) {
            const moboAnchors = moboComponent ? convertApiAnchors(moboComponent.anchor_points || []) : [];
            const caseAnchors = caseComponent ? convertApiAnchors(caseComponent.anchor_points || []) : [];
            const storageAnchors = convertApiAnchors(storageComponent.anchor_points || []);

            // Try M.2 first (on motherboard)
            const m2Slot = moboAnchors.find(a => a.type === "m2_slot");
            const m2Edge = storageAnchors.find(a => a.type === "m2_edge");

            if (m2Slot && moboComponent) {
                const moboTransform = transforms["motherboard"] || { position: new THREE.Vector3(), rotation: new THREE.Euler() };

                const slotOffset = new THREE.Vector3(
                    m2Slot.position[0] * SCALE_FACTOR,
                    m2Slot.position[1] * SCALE_FACTOR,
                    m2Slot.position[2] * SCALE_FACTOR
                );
                slotOffset.applyEuler(moboTransform.rotation);

                const storagePos = moboTransform.position.clone().add(slotOffset);

                if (m2Edge) {
                    const edgeOffset = new THREE.Vector3(
                        m2Edge.position[0] * SCALE_FACTOR,
                        m2Edge.position[1] * SCALE_FACTOR,
                        m2Edge.position[2] * SCALE_FACTOR
                    );
                    edgeOffset.applyEuler(moboTransform.rotation);
                    storagePos.sub(edgeOffset);
                }

                transforms["storage"] = {
                    position: storagePos,
                    rotation: moboTransform.rotation.clone()
                };
            } else {
                // Try drive bays in case
                const driveBay = caseAnchors.find(a => a.type === "drive_bay_25" || a.type === "drive_bay_35");
                if (driveBay) {
                    transforms["storage"] = {
                        position: new THREE.Vector3(
                            driveBay.position[0] * SCALE_FACTOR,
                            driveBay.position[1] * SCALE_FACTOR,
                            driveBay.position[2] * SCALE_FACTOR
                        ),
                        rotation: new THREE.Euler(
                            driveBay.rotation[0],
                            driveBay.rotation[1],
                            driveBay.rotation[2]
                        )
                    };
                } else {
                    transforms["storage"] = {
                        position: new THREE.Vector3(-2, 0, 0),
                        rotation: new THREE.Euler(0, 0, 0)
                    };
                }
            }
        }

        return transforms;
    }, [selectedComponents]);

    // Get RAM slot transforms from motherboard
    const getRamTransforms = useCallback((moboComponent: SelectedComponent | null, quantity: number): ComponentTransform[] => {
        const ramTransforms: ComponentTransform[] = [];
        const moboTransform = componentTransforms["motherboard"] || { position: new THREE.Vector3(), rotation: new THREE.Euler() };

        if (moboComponent?.anchor_points) {
            const ramSlots = convertApiAnchors(moboComponent.anchor_points)
                .filter(a => a.type === "ram_slot")
                .sort((a, b) => a.label.localeCompare(b.label));

            for (let i = 0; i < Math.min(quantity, ramSlots.length); i++) {
                const slot = ramSlots[i];
                const slotOffset = new THREE.Vector3(
                    slot.position[0] * SCALE_FACTOR,
                    slot.position[1] * SCALE_FACTOR,
                    slot.position[2] * SCALE_FACTOR
                );
                slotOffset.applyEuler(moboTransform.rotation);

                ramTransforms.push({
                    position: moboTransform.position.clone().add(slotOffset),
                    rotation: moboTransform.rotation.clone()
                });
            }
        }

        // Fallback positions if not enough slots defined
        while (ramTransforms.length < quantity) {
            const fallbackOffset = new THREE.Vector3(1.5 + (ramTransforms.length * 0.3), 0.1, 0);
            fallbackOffset.applyEuler(moboTransform.rotation);
            ramTransforms.push({
                position: moboTransform.position.clone().add(fallbackOffset),
                rotation: moboTransform.rotation.clone()
            });
        }

        return ramTransforms;
    }, [componentTransforms]);

    // Render RAM sticks based on quantity and anchor transforms
    const renderRamModules = (component: SelectedComponent & { stepId: string }) => {
        const quantity = component.quantity || 1;
        const moboComponent = selectedComponents.find(c => c.stepId === "motherboard") || null;
        const ramTransforms = getRamTransforms(moboComponent, quantity);

        return ramTransforms.map((transform, i) => (
            <ComponentModel
                key={`${component.id}-ram-${i}`}
                component={component}
                position={transform.position}
                rotation={transform.rotation}
            />
        ));
    };

    return (
        <>
            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
            <Environment preset="studio" />

            {/* Render all selected components */}
            {selectedComponents.map((component, index) => {
                const transform = componentTransforms[component.stepId] || {
                    position: new THREE.Vector3(index * 2, 0, 0),
                    rotation: new THREE.Euler(0, 0, 0)
                };

                // Use CaseModel for case components with model URL
                if (component.stepId === "case" && component.model_url) {
                    return (
                        <Suspense
                            key={component.id}
                            fallback={
                                <mesh position={transform.position}>
                                    <boxGeometry args={[4, 5, 4]} />
                                    <meshStandardMaterial color="#888" wireframe />
                                </mesh>
                            }
                        >
                            <CaseModel
                                component={component}
                                position={transform.position}
                                onRemovablePartsFound={onRemovablePartsFound}
                                removablePartsVisibility={removablePartsVisibility}
                            />
                        </Suspense>
                    );
                }

                // Render multiple RAM modules based on quantity
                if (component.stepId === "ram") {
                    return renderRamModules(component);
                }

                // Use regular ComponentModel for other components
                return (
                    <ComponentModel
                        key={component.id}
                        component={component}
                        position={transform.position}
                        rotation={transform.rotation}
                    />
                );
            })}

            {/* Show placeholder if no components */}
            {selectedComponents.length === 0 && (
                <Html center>
                    <div className="text-center text-muted-foreground">
                        <p className="text-lg">Start building!</p>
                        <p className="text-sm">Select a {currentStep.label}</p>
                    </div>
                </Html>
            )}

            <ContactShadows
                position={[0, -2, 0]}
                opacity={0.4}
                scale={20}
                blur={2}
            />

            <Grid
                infiniteGrid
                fadeDistance={30}
                fadeStrength={5}
                cellSize={1}
                sectionSize={5}
                cellColor="#444"
                sectionColor="#666"
                position={[0, -2, 0]}
            />

            <OrbitControls
                makeDefault
                minDistance={5}
                maxDistance={50}
                target={[0, 0, 0]}
            />
        </>
    );
}

export default function BuilderCanvas({ selectedComponents, currentStep }: BuilderCanvasProps) {
    const [removableParts, setRemovableParts] = useState<RemovablePart[]>([]);
    const [removablePartsVisibility, setRemovablePartsVisibility] = useState<Record<string, boolean>>({});
    const [panelOpen, setPanelOpen] = useState(true);

    const handleRemovablePartsFound = useCallback((parts: RemovablePart[]) => {
        setRemovableParts(parts);
        // Initialize visibility state
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

    const showAll = useCallback(() => {
        setRemovablePartsVisibility((prev) => {
            const updated: Record<string, boolean> = {};
            Object.keys(prev).forEach((key) => {
                updated[key] = true;
            });
            return updated;
        });
    }, []);

    const hideAll = useCallback(() => {
        setRemovablePartsVisibility((prev) => {
            const updated: Record<string, boolean> = {};
            Object.keys(prev).forEach((key) => {
                updated[key] = false;
            });
            return updated;
        });
    }, []);

    // Reset removable parts when case changes
    useEffect(() => {
        const hasCase = selectedComponents.some((c) => c.stepId === "case");
        if (!hasCase) {
            setRemovableParts([]);
            setRemovablePartsVisibility({});
        }
    }, [selectedComponents]);

    return (
        <div className="relative w-full h-full bg-gradient-to-b from-gray-900 to-gray-950">
            {/* Removable Parts Panel */}
            {removableParts.length > 0 && (
                <div className="absolute top-4 left-4 z-10">
                    <div className="bg-background/90 backdrop-blur-sm rounded-lg border shadow-lg overflow-hidden">
                        <div className="flex items-center justify-between p-2 border-b">
                            <span className="text-sm font-medium px-2">Case Panels</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setPanelOpen(!panelOpen)}
                            >
                                {panelOpen ? (
                                    <PanelLeftClose className="h-4 w-4" />
                                ) : (
                                    <PanelLeftOpen className="h-4 w-4" />
                                )}
                            </Button>
                        </div>

                        {panelOpen && (
                            <div className="p-2 space-y-1">
                                {/* Quick actions */}
                                <div className="flex gap-1 mb-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-7 flex-1"
                                        onClick={showAll}
                                    >
                                        Show All
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-7 flex-1"
                                        onClick={hideAll}
                                    >
                                        Hide All
                                    </Button>
                                </div>

                                {/* Individual toggles */}
                                {removableParts.map((part) => (
                                    <button
                                        key={part.name}
                                        onClick={() => togglePart(part.name)}
                                        className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors"
                                    >
                                        {removablePartsVisibility[part.name] ? (
                                            <Eye className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <span className={removablePartsVisibility[part.name] ? "" : "text-muted-foreground"}>
                                            {part.displayName}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <Canvas
                camera={{ position: [10, 8, 10], fov: 50 }}
                shadows
            >
                <Suspense fallback={
                    <Html center>
                        <div className="flex items-center gap-2 text-white">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Loading...
                        </div>
                    </Html>
                }>
                    <Scene
                        selectedComponents={selectedComponents}
                        currentStep={currentStep}
                        onRemovablePartsFound={handleRemovablePartsFound}
                        removablePartsVisibility={removablePartsVisibility}
                    />
                </Suspense>
            </Canvas>
        </div>
    );
}
