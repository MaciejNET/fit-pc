import React, { useMemo } from 'react';
import { Box, Plane, Edges, Cone, Cylinder } from '@react-three/drei';
import * as THREE from 'three';
import { DIMENSIONS } from '@/lib/constants/dimensions';
import { AnchorType, AnchorDirection, ConnectionAxis, ANCHOR_TYPE_INFO } from '@/store/useAnchorStore';

interface GhostSocketProps {
    type: AnchorType;
    isSelected?: boolean;
    direction?: AnchorDirection;
    connectionAxis?: ConnectionAxis;
    onClick?: (e: any) => void;
}

// Direction arrow component - shows connection direction based on ConnectionAxis
function DirectionArrow({
    direction,
    connectionAxis,
    offset
}: {
    direction: AnchorDirection;
    connectionAxis: ConnectionAxis;
    offset: [number, number, number];
}) {
    // Green = input (component inserts here), Red = output (this provides connection)
    const arrowColor = direction === 'input' ? '#00ff00' : '#ff4444';

    // Determine arrow direction based on ConnectionAxis
    const getArrowTransform = (): { rotation: [number, number, number]; position: [number, number, number] } => {
        const arrowLength = 0.8;
        switch (connectionAxis) {
            case 'Y_NEG': // Points down (motherboard slots)
                return {
                    rotation: [Math.PI, 0, 0],
                    position: [offset[0], offset[1] - arrowLength, offset[2]]
                };
            case 'Y_POS': // Points up (connectors on bottom of components)
                return {
                    rotation: [0, 0, 0],
                    position: [offset[0], offset[1] + arrowLength, offset[2]]
                };
            case 'Z_NEG': // Points backward (front panel connectors)
                return {
                    rotation: [Math.PI / 2, 0, 0],
                    position: [offset[0], offset[1], offset[2] - arrowLength]
                };
            case 'Z_POS': // Points forward (back IO)
                return {
                    rotation: [-Math.PI / 2, 0, 0],
                    position: [offset[0], offset[1], offset[2] + arrowLength]
                };
            case 'X_NEG': // Points left
                return {
                    rotation: [0, 0, -Math.PI / 2],
                    position: [offset[0] - arrowLength, offset[1], offset[2]]
                };
            case 'X_POS': // Points right
                return {
                    rotation: [0, 0, Math.PI / 2],
                    position: [offset[0] + arrowLength, offset[1], offset[2]]
                };
        }
    };

    const { rotation, position } = getArrowTransform();

    return (
        <group position={position}>
            <Cone
                args={[0.3, 0.6, 8]}
                rotation={rotation}
            >
                <meshStandardMaterial color={arrowColor} emissive={arrowColor} emissiveIntensity={0.3} />
            </Cone>
            {/* Stem */}
            <Cylinder
                args={[0.08, 0.08, 0.5, 8]}
                position={[0, -0.3, 0]}
            >
                <meshStandardMaterial color={arrowColor} emissive={arrowColor} emissiveIntensity={0.2} />
            </Cylinder>
        </group>
    );
}

export function GhostSocket({
    type,
    isSelected,
    direction = 'output',
    connectionAxis = 'Y_NEG',
    onClick
}: GhostSocketProps) {

    // Colors - add direction tint
    const baseColor = isSelected ? '#ff9900' : '#4287f5'; // Orange for selected, Blue for normal
    const color = isSelected ? baseColor : (direction === 'input' ? '#44bb44' : '#4287f5');
    const opacity = 0.5;

    // Geometry & Offset Logic for all anchor types
    const visualContent = useMemo(() => {
        const commonMaterial = <meshStandardMaterial color={color} transparent opacity={opacity} />;
        const commonEdges = <Edges color="white" linewidth={1.5} />;

        switch (type) {
            // === MOTHERBOARD SLOTS (outputs) ===
            case 'cpu_socket':
                return (
                    <Box args={[DIMENSIONS.CPU_SOCKET_AM4, DIMENSIONS.PCB_THICKNESS, DIMENSIONS.CPU_SOCKET_AM4]} position={[0, 0, 0]}>
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );

            case 'ram_slot':
                return (
                    <Box args={[DIMENSIONS.RAM_DIMM_LEN, DIMENSIONS.PCB_THICKNESS, 0.5]} position={[0, 0, 0]}>
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );

            case 'pcie_x16':
            case 'pcie_x4':
            case 'pcie_x1': {
                const length = type === 'pcie_x16' ? DIMENSIONS.PCIE_X16_LEN :
                    type === 'pcie_x4' ? DIMENSIONS.PCIE_X4_LEN : DIMENSIONS.PCIE_X1_LEN;
                return (
                    <Box args={[length, DIMENSIONS.PCB_THICKNESS, 0.5]} position={[0, 0, 0]}>
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );
            }

            case 'm2_slot':
                return (
                    <Box
                        args={[DIMENSIONS.M2_2280.width, DIMENSIONS.M2_2280.height, DIMENSIONS.M2_2280.depth]}
                        position={[0, 0, 0]}
                    >
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );

            case 'sata_port':
                return (
                    <Box args={[1.5, 0.3, 1.0]} position={[0, 0, 0]}>
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );

            case 'cooler_plate':
                return (
                    <Box args={[DIMENSIONS.COOLER_BASE_AM4, DIMENSIONS.PCB_THICKNESS, DIMENSIONS.COOLER_BASE_AM4]} position={[0, 0, 0]}>
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );

            // === CASE MOUNTS (outputs) ===
            case 'mobo_mount_area':
                // Large rectangle showing ATX motherboard mounting area (30.5cm x 24.4cm)
                return (
                    <group>
                        <Plane args={[DIMENSIONS.MOBO_ATX.width, DIMENSIONS.MOBO_ATX.depth]} rotation={[-Math.PI / 2, 0, 0]}>
                            <meshStandardMaterial
                                color={color}
                                transparent
                                opacity={0.2}
                                side={2} // DoubleSide
                            />
                        </Plane>
                        <Edges
                            geometry={(() => {
                                const planeGeo = new THREE.PlaneGeometry(DIMENSIONS.MOBO_ATX.width, DIMENSIONS.MOBO_ATX.depth);
                                planeGeo.rotateX(-Math.PI / 2);
                                return planeGeo;
                            })()}
                        >
                            <lineBasicMaterial color={color} linewidth={2} />
                        </Edges>
                        {/* Center marker */}
                        <Cylinder args={[0.5, 0.5, 0.2, 8]} rotation={[Math.PI / 2, 0, 0]}>
                            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
                        </Cylinder>
                    </group>
                );

            case 'psu_bay':
                return (
                    <Box
                        args={[DIMENSIONS.PSU_ATX.width, DIMENSIONS.PSU_ATX.height, DIMENSIONS.PSU_ATX.depth]}
                        position={[0, 0, 0]}
                    >
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );

            case 'fan_mount_120':
                return (
                    <Box args={[DIMENSIONS.FAN_120.width, DIMENSIONS.FAN_120.height, DIMENSIONS.FAN_120.depth]} position={[0, 0, 0]}>
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );

            case 'fan_mount_140':
                return (
                    <Box args={[DIMENSIONS.FAN_140.width, DIMENSIONS.FAN_140.height, DIMENSIONS.FAN_140.depth]} position={[0, 0, 0]}>
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );

            case 'drive_bay_25':
                return (
                    <Box
                        args={[DIMENSIONS.DRIVE_25.width, DIMENSIONS.DRIVE_25.height, DIMENSIONS.DRIVE_25.depth]}
                        position={[0, 0, 0]}
                    >
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );

            case 'drive_bay_35':
                return (
                    <Box
                        args={[DIMENSIONS.DRIVE_35.width, DIMENSIONS.DRIVE_35.height, DIMENSIONS.DRIVE_35.depth]}
                        position={[0, 0, 0]}
                    >
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );

            // === COMPONENT CONNECTORS (inputs) ===
            case 'cpu_bottom':
                return (
                    <Box args={[DIMENSIONS.CPU_SOCKET_AM4, DIMENSIONS.PCB_THICKNESS, DIMENSIONS.CPU_SOCKET_AM4]} position={[0, 0, 0]}>
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );

            case 'cooler_base':
                return (
                    <Box args={[DIMENSIONS.COOLER_BASE_AM4, 0.3, DIMENSIONS.COOLER_BASE_AM4]} position={[0, 0, 0]}>
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );

            case 'ram_edge':
                return (
                    <Box args={[DIMENSIONS.RAM_DIMM_LEN, DIMENSIONS.RAM_DIMM_HEIGHT, DIMENSIONS.PCB_THICKNESS]} position={[0, 0, 0]}>
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );

            case 'pcie_edge':
                return (
                    <Box args={[DIMENSIONS.PCIE_X16_LEN, 1.0, DIMENSIONS.PCB_THICKNESS]} position={[0, 0, 0]}>
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );

            case 'm2_edge':
                return (
                    <Box
                        args={[DIMENSIONS.M2_2280.width, DIMENSIONS.M2_2280.height, DIMENSIONS.M2_2280.depth]}
                        position={[0, 0, 0]}
                    >
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );

            case 'sata_plug':
                return (
                    <Box args={[1.3, 0.25, 0.8]} position={[0, 0, 0]}>
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );

            case 'mobo_backplate':
                // Center point of motherboard for mounting
                return (
                    <group>
                        <Cylinder args={[1.0, 1.0, 0.5, 16]}>
                            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} transparent opacity={opacity} />
                        </Cylinder>
                        {/* Small cross marker */}
                        <Box args={[2, 0.1, 0.1]} position={[0, 0.3, 0]}>
                            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
                        </Box>
                        <Box args={[0.1, 0.1, 2]} position={[0, 0.3, 0]}>
                            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
                        </Box>
                    </group>
                );

            case 'psu_mount':
                return (
                    <Box args={[DIMENSIONS.PSU_ATX.width, DIMENSIONS.PSU_ATX.height, 0.5]} position={[0, 0, 0]}>
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );

            case 'fan_mount':
                return (
                    <Cylinder args={[0.3, 0.3, 0.5, 8]}>
                        {commonMaterial}
                    </Cylinder>
                );

            case 'drive_mount':
                return (
                    <Box args={[0.5, 0.5, 0.3]} position={[0, 0, 0]}>
                        {commonMaterial}
                        {commonEdges}
                    </Box>
                );

            default:
                // Fallback for unknown types
                return (
                    <Box args={[1, 1, 1]}>
                        {commonMaterial}
                    </Box>
                );
        }
    }, [type, color]);

    // Calculate arrow offset based on geometry
    const arrowOffset: [number, number, number] = useMemo(() => {
        switch (type) {
            case 'cpu_socket':
            case 'cpu_bottom':
                return [0, DIMENSIONS.PCB_THICKNESS / 2, 0];
            case 'ram_slot':
            case 'ram_edge':
                return [0, DIMENSIONS.RAM_DIMM_HEIGHT / 2, 0];
            case 'pcie_x16':
            case 'pcie_x4':
            case 'pcie_x1':
            case 'pcie_edge':
                return [0, 0.5, 0];
            case 'cooler_plate':
            case 'cooler_base':
                return [0, 0.15, 0];
            case 'psu_bay':
            case 'psu_mount':
                return [0, DIMENSIONS.PSU_ATX.height / 2, 0];
            case 'fan_mount_120':
                return [0, DIMENSIONS.FAN_120.height / 2, 0];
            case 'fan_mount_140':
                return [0, DIMENSIONS.FAN_140.height / 2, 0];
            case 'drive_bay_25':
            case 'drive_mount':
                return [0, DIMENSIONS.DRIVE_25.height / 2, 0];
            case 'drive_bay_35':
                return [0, DIMENSIONS.DRIVE_35.height / 2, 0];
            default:
                return [0, 0.5, 0];
        }
    }, [type]);

    return (
        <group onClick={onClick}>
            {visualContent}
            <DirectionArrow
                direction={direction}
                connectionAxis={connectionAxis}
                offset={arrowOffset}
            />
        </group>
    );
}
