export const DIMENSIONS = {
    // PCB & Slots
    PCB_THICKNESS: 0.2, // cm
    PCIE_X16_LEN: 8.9,  // cm
    PCIE_X4_LEN: 3.9,   // cm
    PCIE_X1_LEN: 2.5,   // cm
    RAM_DIMM_LEN: 13.3, // cm
    RAM_DIMM_HEIGHT: 3.2, // cm (standard height without heatsink)

    // CPU Sockets
    CPU_SOCKET_AM4: 4.0,    // cm (4.0 x 4.0)
    CPU_SOCKET_AM5: 4.0,    // cm
    CPU_SOCKET_LGA1700: 4.5, // cm

    // M.2 SSD
    M2_2280: {
        width: 2.2,
        height: 0.2,
        depth: 8.0,
    },
    M2_2260: {
        width: 2.2,
        height: 0.2,
        depth: 6.0,
    },
    M2_2242: {
        width: 2.2,
        height: 0.2,
        depth: 4.2,
    },

    // Storage drives
    DRIVE_25: {
        width: 7.0,
        height: 0.7,
        depth: 10.0,
    },
    DRIVE_35: {
        width: 10.2,
        height: 2.6,
        depth: 14.7,
    },

    // Components
    FAN_120: {
        width: 12.0,
        height: 12.0,
        depth: 2.5,
    },
    FAN_140: {
        width: 14.0,
        height: 14.0,
        depth: 2.5,
    },
    PSU_ATX: {
        width: 15.0,
        height: 8.6,
        depth: 14.0,
    },
    PSU_SFX: {
        width: 12.5,
        height: 6.3,
        depth: 10.0,
    },

    // CPU Coolers (base contact area, same as socket)
    COOLER_BASE_AM4: 4.0,
    COOLER_BASE_LGA1700: 4.5,

    // Motherboard form factors
    MOBO_ATX: {
        width: 30.5,
        height: 0.2,
        depth: 24.4,
    },
    MOBO_MATX: {
        width: 24.4,
        height: 0.2,
        depth: 24.4,
    },
} as const;
