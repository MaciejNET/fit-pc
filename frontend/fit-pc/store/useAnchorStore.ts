import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

// Slot types (outputs - receive components)
export type SlotAnchorType =
    | 'cpu_socket'      // Motherboard CPU socket
    | 'ram_slot'        // Motherboard RAM DIMM slot
    | 'pcie_x16'        // Motherboard PCIe x16 slot
    | 'pcie_x4'         // Motherboard PCIe x4 slot
    | 'pcie_x1'         // Motherboard PCIe x1 slot
    | 'm2_slot'         // Motherboard M.2 slot
    | 'sata_port'       // Motherboard SATA port
    | 'cooler_plate'    // CPU top surface for cooler
    | 'mobo_mount_area' // Case motherboard mounting area (ATX/mATX/ITX)
    | 'psu_bay'         // Case PSU bay
    | 'fan_mount_120'   // Case 120mm fan mount
    | 'fan_mount_140'   // Case 140mm fan mount
    | 'drive_bay_25'    // Case 2.5" drive bay
    | 'drive_bay_35';   // Case 3.5" drive bay

// Component connector types (inputs - plug into slots)
export type ConnectorAnchorType =
    | 'cpu_bottom'      // CPU underside pins/contacts
    | 'cooler_base'     // CPU cooler contact plate
    | 'ram_edge'        // RAM stick edge connector
    | 'pcie_edge'       // GPU/card PCIe edge connector
    | 'm2_edge'         // M.2 SSD edge connector
    | 'sata_plug'       // SATA data connector
    | 'mobo_backplate'  // Motherboard mounting center point
    | 'psu_mount'       // PSU mounting point
    | 'fan_mount'       // Fan mounting holes
    | 'drive_mount';    // Drive mounting holes

export type AnchorType = SlotAnchorType | ConnectorAnchorType;

// Connection axis - direction of insertion/mounting
export type ConnectionAxis =
    | 'Y_NEG'   // From top going down (CPU into socket, RAM into slot)
    | 'Y_POS'   // From bottom going up (cooler onto CPU)
    | 'Z_NEG'   // From front going back (GPU into PCIe)
    | 'Z_POS'   // From back going front
    | 'X_NEG'   // From right going left
    | 'X_POS';  // From left going right

export type AnchorDirection = 'input' | 'output';

export interface Anchor {
    id: string;
    type: AnchorType;
    label: string;
    position: [number, number, number];
    rotation: [number, number, number];
    direction: AnchorDirection;
    connectionAxis: ConnectionAxis;
    compatibleWith: AnchorType[];
}

interface AnchorState {
    anchors: Anchor[];
    selectedAnchorId: string | null;

    addAnchor: (type: AnchorType, label?: string) => void;
    duplicateAnchor: (id: string) => void;
    updateAnchor: (id: string, updates: Partial<Pick<Anchor, 'position' | 'rotation' | 'direction' | 'label' | 'connectionAxis' | 'compatibleWith'>>) => void;
    selectAnchor: (id: string | null) => void;
    removeAnchor: (id: string) => void;
    setAnchors: (anchors: Anchor[]) => void;
    clearAnchors: () => void;
}

// Anchor type metadata
export const ANCHOR_TYPE_INFO: Record<AnchorType, {
    label: string;
    direction: AnchorDirection;
    defaultAxis: ConnectionAxis;
    defaultCompatible: AnchorType[];
    category: 'motherboard' | 'cpu' | 'case' | 'component';
}> = {
    // Motherboard slots (outputs)
    cpu_socket: { label: 'CPU Socket', direction: 'output', defaultAxis: 'Y_NEG', defaultCompatible: ['cpu_bottom'], category: 'motherboard' },
    ram_slot: { label: 'RAM Slot', direction: 'output', defaultAxis: 'Y_NEG', defaultCompatible: ['ram_edge'], category: 'motherboard' },
    pcie_x16: { label: 'PCIe x16 Slot', direction: 'output', defaultAxis: 'Z_NEG', defaultCompatible: ['pcie_edge'], category: 'motherboard' },
    pcie_x4: { label: 'PCIe x4 Slot', direction: 'output', defaultAxis: 'Z_NEG', defaultCompatible: ['pcie_edge'], category: 'motherboard' },
    pcie_x1: { label: 'PCIe x1 Slot', direction: 'output', defaultAxis: 'Z_NEG', defaultCompatible: ['pcie_edge'], category: 'motherboard' },
    m2_slot: { label: 'M.2 Slot', direction: 'output', defaultAxis: 'Z_NEG', defaultCompatible: ['m2_edge'], category: 'motherboard' },
    sata_port: { label: 'SATA Port', direction: 'output', defaultAxis: 'Z_NEG', defaultCompatible: ['sata_plug'], category: 'motherboard' },

    // CPU surface (output for cooler)
    cooler_plate: { label: 'Cooler Plate', direction: 'output', defaultAxis: 'Y_POS', defaultCompatible: ['cooler_base'], category: 'cpu' },

    // Case mounts (outputs)
    mobo_mount_area: { label: 'Motherboard Mount Area', direction: 'output', defaultAxis: 'Y_POS', defaultCompatible: ['mobo_backplate'], category: 'case' },
    psu_bay: { label: 'PSU Bay', direction: 'output', defaultAxis: 'Z_NEG', defaultCompatible: ['psu_mount'], category: 'case' },
    fan_mount_120: { label: 'Fan Mount 120mm', direction: 'output', defaultAxis: 'Z_NEG', defaultCompatible: ['fan_mount'], category: 'case' },
    fan_mount_140: { label: 'Fan Mount 140mm', direction: 'output', defaultAxis: 'Z_NEG', defaultCompatible: ['fan_mount'], category: 'case' },
    drive_bay_25: { label: '2.5" Drive Bay', direction: 'output', defaultAxis: 'Z_NEG', defaultCompatible: ['drive_mount'], category: 'case' },
    drive_bay_35: { label: '3.5" Drive Bay', direction: 'output', defaultAxis: 'Z_NEG', defaultCompatible: ['drive_mount'], category: 'case' },

    // Component connectors (inputs)
    cpu_bottom: { label: 'CPU Contact', direction: 'input', defaultAxis: 'Y_NEG', defaultCompatible: ['cpu_socket'], category: 'component' },
    cooler_base: { label: 'Cooler Base', direction: 'input', defaultAxis: 'Y_POS', defaultCompatible: ['cooler_plate'], category: 'component' },
    ram_edge: { label: 'RAM Edge', direction: 'input', defaultAxis: 'Y_NEG', defaultCompatible: ['ram_slot'], category: 'component' },
    pcie_edge: { label: 'PCIe Edge', direction: 'input', defaultAxis: 'Z_NEG', defaultCompatible: ['pcie_x16', 'pcie_x4', 'pcie_x1'], category: 'component' },
    m2_edge: { label: 'M.2 Edge', direction: 'input', defaultAxis: 'Z_NEG', defaultCompatible: ['m2_slot'], category: 'component' },
    sata_plug: { label: 'SATA Plug', direction: 'input', defaultAxis: 'Z_NEG', defaultCompatible: ['sata_port'], category: 'component' },
    mobo_backplate: { label: 'Motherboard Backplate', direction: 'input', defaultAxis: 'Y_NEG', defaultCompatible: ['mobo_mount_area'], category: 'component' },
    psu_mount: { label: 'PSU Mount', direction: 'input', defaultAxis: 'Z_NEG', defaultCompatible: ['psu_bay'], category: 'component' },
    fan_mount: { label: 'Fan Mount', direction: 'input', defaultAxis: 'Z_NEG', defaultCompatible: ['fan_mount_120', 'fan_mount_140'], category: 'component' },
    drive_mount: { label: 'Drive Mount', direction: 'input', defaultAxis: 'Z_NEG', defaultCompatible: ['drive_bay_25', 'drive_bay_35'], category: 'component' },
};

// Helper to generate default label
const getDefaultLabel = (type: AnchorType, existingAnchors: Anchor[]): string => {
    const info = ANCHOR_TYPE_INFO[type];
    const sameTypeCount = existingAnchors.filter(a => a.type === type).length + 1;
    return `${info.label} ${sameTypeCount}`;
};

export const useAnchorStore = create<AnchorState>((set) => ({
    anchors: [],
    selectedAnchorId: null,

    addAnchor: (type, label) =>
        set((state) => {
            const info = ANCHOR_TYPE_INFO[type];
            return {
                anchors: [
                    ...state.anchors,
                    {
                        id: uuidv4(),
                        type,
                        label: label || getDefaultLabel(type, state.anchors),
                        position: [0, 0, 0],
                        rotation: [0, 0, 0],
                        direction: info.direction,
                        connectionAxis: info.defaultAxis,
                        compatibleWith: info.defaultCompatible,
                    },
                ],
                selectedAnchorId: null,
            };
        }),

    duplicateAnchor: (id) =>
        set((state) => {
            const anchor = state.anchors.find(a => a.id === id);
            if (!anchor) return state;

            const newAnchor: Anchor = {
                ...anchor,
                id: uuidv4(),
                label: getDefaultLabel(anchor.type, state.anchors),
                // Offset position slightly so it's not exactly on top
                position: [
                    anchor.position[0] + 1,
                    anchor.position[1],
                    anchor.position[2]
                ] as [number, number, number],
            };

            return {
                anchors: [...state.anchors, newAnchor],
                selectedAnchorId: newAnchor.id, // Auto-select the duplicate
            };
        }),

    updateAnchor: (id, updates) =>
        set((state) => ({
            anchors: state.anchors.map((anchor) =>
                anchor.id === id ? { ...anchor, ...updates } : anchor
            ),
        })),

    selectAnchor: (id) => set({ selectedAnchorId: id }),

    removeAnchor: (id) =>
        set((state) => ({
            anchors: state.anchors.filter((a) => a.id !== id),
            selectedAnchorId: state.selectedAnchorId === id ? null : state.selectedAnchorId,
        })),

    setAnchors: (anchors) => set({ anchors, selectedAnchorId: null }),

    clearAnchors: () => set({ anchors: [], selectedAnchorId: null }),
}));
