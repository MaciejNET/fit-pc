import { z } from "zod";

export const ProductCategories = [
  "CPU",
  "CPU_COOLER",
  "MOTHERBOARD",
  "RAM",
  "GPU",
  "CASE",
  "PSU",
  "STORAGE",
] as const;

export type ProductCategory = (typeof ProductCategories)[number];

// --- Shared Enums ---
export const FormFactorEnum = z.enum(["ATX", "mATX", "ITX"]);
export const RamTypeEnum = z.enum(["DDR4", "DDR5"]);
export const StorageTypeEnum = z.enum(["M.2", "SATA"]);

// --- Base Schema ---
// All products share these fields
const BaseProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.coerce.number().min(0, "Price must be positive"),
  sku: z.string().min(1, "SKU is required"),
  model_url: z.string().url("Valid URL required").optional().or(z.literal("")),
});

// --- Category Specific Schemas ---

// 1. CPU
const CpuSchema = BaseProductSchema.extend({
  category: z.literal("CPU"),
  technical_specs: z.object({
    socket: z.string().min(1, "Socket is required"),
    tdp_watts: z.coerce.number().positive("TDP must be positive"),
    integrated_graphics: z.coerce.boolean(),
  }),
});

// 2. CPU_COOLER
const CpuCoolerSchema = BaseProductSchema.extend({
  category: z.literal("CPU_COOLER"),
  technical_specs: z.object({
    supported_sockets: z.array(z.string()).min(1, "Must support at least one socket"),
    height_mm: z.coerce.number().positive("Height is required"),
    tdp_rating_watts: z.coerce.number().positive("TDP rating is required"),
    fan_size_mm: z.coerce.number().positive().optional(),
  }),
});

// 3. MOTHERBOARD
const MotherboardSchema = BaseProductSchema.extend({
  category: z.literal("MOTHERBOARD"),
  technical_specs: z.object({
    socket: z.string().min(1, "Socket is required"),
    form_factor: FormFactorEnum,
    ram_type: RamTypeEnum,
    ram_slots: z.coerce.number().int().positive("Must have at least 1 slot"),
    m2_slots: z.coerce.number().int().min(0),
  }),
});

// 4. RAM
const RamSchema = BaseProductSchema.extend({
  category: z.literal("RAM"),
  technical_specs: z.object({
    type: RamTypeEnum,
    capacity_gb: z.coerce.number().positive(),
    modules_count: z.coerce.number().int().positive(),
    speed_mhz: z.coerce.number().positive(),
  }),
});

// 5. GPU
const GpuSchema = BaseProductSchema.extend({
  category: z.literal("GPU"),
  technical_specs: z.object({
    length_mm: z.coerce.number().positive("Length is critical for fit"),
    tdp_watts: z.coerce.number().positive(),
    vram_gb: z.coerce.number().positive(),
  }),
});

// 6. CASE
const CaseSchema = BaseProductSchema.extend({
  category: z.literal("CASE"),
  technical_specs: z.object({
    supported_motherboards: z.array(FormFactorEnum).min(1, "Must support at least one form factor"),
    max_gpu_length_mm: z.coerce.number().positive(),
    max_cpu_cooler_height_mm: z.coerce.number().positive(),
  }),
});

// 7. PSU
const PsuSchema = BaseProductSchema.extend({
  category: z.literal("PSU"),
  technical_specs: z.object({
    wattage: z.coerce.number().positive(),
    form_factor: z.string().min(1, "Form factor is required"),
  }),
});

// 8. STORAGE
const StorageSchema = BaseProductSchema.extend({
  category: z.literal("STORAGE"),
  technical_specs: z.object({
    type: StorageTypeEnum,
    interface: z.string().min(1, "Interface is required (e.g., NVMe, SATA III)"),
  }),
});

// --- Discriminated Union ---
export const ProductSchema = z.discriminatedUnion("category", [
  CpuSchema,
  CpuCoolerSchema,
  MotherboardSchema,
  RamSchema,
  GpuSchema,
  CaseSchema,
  PsuSchema,
  StorageSchema,
]);

export type ProductValues = z.infer<typeof ProductSchema>;
