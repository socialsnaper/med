"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportPayloadSchema = exports.ImportRowSchema = exports.UpdateCleaningEquipmentSchema = exports.CreateCleaningEquipmentSchema = exports.CLEANING_TYPES = void 0;
const zod_1 = require("zod");
exports.CLEANING_TYPES = ['dry', 'wet', 'sanitizing', 'general'];
exports.CreateCleaningEquipmentSchema = zod_1.z.object({
    equipmentName: zod_1.z.string().min(1, 'Name is required').max(150).trim(),
    equipmentDetails: zod_1.z.string().max(2000).trim().optional(),
    cleaningType: zod_1.z.enum(exports.CLEANING_TYPES).optional(),
    material: zod_1.z.string().max(100).trim().optional(),
    requiresReplacement: zod_1.z.boolean().optional(),
    replacementIntervalDays: zod_1.z.number().int().min(1).nullable().optional(),
    displayOrder: zod_1.z.number().int().min(0).optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.UpdateCleaningEquipmentSchema = zod_1.z.object({
    equipmentName: zod_1.z.string().min(1).max(150).trim().optional(),
    equipmentDetails: zod_1.z.string().max(2000).trim().nullable().optional(),
    cleaningType: zod_1.z.enum(exports.CLEANING_TYPES).optional(),
    material: zod_1.z.string().max(100).trim().nullable().optional(),
    requiresReplacement: zod_1.z.boolean().optional(),
    replacementIntervalDays: zod_1.z.number().int().min(1).nullable().optional(),
    displayOrder: zod_1.z.number().int().min(0).optional(),
    isActive: zod_1.z.boolean().optional(),
});
/** Single row for CSV import — equipment_code is auto-generated */
exports.ImportRowSchema = zod_1.z.object({
    equipmentName: zod_1.z.string().min(1).max(150).trim(),
    equipmentDetails: zod_1.z.string().max(2000).optional(),
    cleaningType: zod_1.z.enum(exports.CLEANING_TYPES).optional(),
    material: zod_1.z.string().max(100).optional(),
    requiresReplacement: zod_1.z
        .union([zod_1.z.boolean(), zod_1.z.string()])
        .transform((v) => v === true || v === 'true' || v === '1' || v === 'yes')
        .optional(),
    replacementIntervalDays: zod_1.z.coerce.number().int().min(1).nullable().optional(),
    displayOrder: zod_1.z.coerce.number().int().min(0).optional(),
});
exports.ImportPayloadSchema = zod_1.z.object({
    rows: zod_1.z.array(exports.ImportRowSchema).min(1).max(500),
});
