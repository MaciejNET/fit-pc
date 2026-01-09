"use client";

import { useState, useCallback, useEffect } from "react";
import * as THREE from "three";

export interface RemovablePart {
    name: string;
    displayName: string;
    visible: boolean;
    mesh: THREE.Mesh;
}

export function useRemovableParts(scene: THREE.Object3D | null) {
    const [removableParts, setRemovableParts] = useState<RemovablePart[]>([]);

    // Scan scene for Part_Removable_* meshes
    useEffect(() => {
        if (!scene) {
            setRemovableParts([]);
            return;
        }

        const parts: RemovablePart[] = [];

        scene.traverse((child) => {
            if (child instanceof THREE.Mesh && child.name.startsWith("Part_Removable_")) {
                // Extract display name from mesh name
                // e.g., "Part_Removable_Side_Panel_Left" -> "Side Panel Left"
                const displayName = child.name
                    .replace("Part_Removable_", "")
                    .replace(/_/g, " ");

                parts.push({
                    name: child.name,
                    displayName,
                    visible: child.visible,
                    mesh: child,
                });
            }
        });

        setRemovableParts(parts);
    }, [scene]);

    // Toggle visibility of a specific part
    const togglePart = useCallback((partName: string) => {
        setRemovableParts((prev) =>
            prev.map((part) => {
                if (part.name === partName) {
                    part.mesh.visible = !part.mesh.visible;
                    return { ...part, visible: part.mesh.visible };
                }
                return part;
            })
        );
    }, []);

    // Show all removable parts
    const showAll = useCallback(() => {
        setRemovableParts((prev) =>
            prev.map((part) => {
                part.mesh.visible = true;
                return { ...part, visible: true };
            })
        );
    }, []);

    // Hide all removable parts
    const hideAll = useCallback(() => {
        setRemovableParts((prev) =>
            prev.map((part) => {
                part.mesh.visible = false;
                return { ...part, visible: false };
            })
        );
    }, []);

    return {
        removableParts,
        togglePart,
        showAll,
        hideAll,
        hasRemovableParts: removableParts.length > 0,
    };
}
