"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportProcessTypePayloadSchema = exports.ImportProcessTypeRowSchema = exports.UpdateProcessTypeSchema = exports.CreateProcessTypeSchema = void 0;
const zod_1 = require("zod");
exports.CreateProcessTypeSchema = zod_1.z.object({
    processType: zod_1.z.string().min(1, 'Process type name is required').max(150).trim(),
    processDetails: zod_1.z.string().max(2000).trim().optional(),
    processGroup: zod_1.z.string().max(100).trim().optional(),
    typicalDurationMin: zod_1.z.number().int().min(1).nullable().optional(),
    requiresCleanRoom: zod_1.z.boolean().optional(),
    displayOrder: zod_1.z.number().int().min(0).optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.UpdateProcessTypeSchema = zod_1.z.object({
    processType: zod_1.z.string().min(1).max(150).trim().optional(),
    processDetails: zod_1.z.string().max(2000).trim().nullable().optional(),
    processGroup: zod_1.z.string().max(100).trim().nullable().optional(),
    typicalDurationMin: zod_1.z.number().int().min(1).nullable().optional(),
    requiresCleanRoom: zod_1.z.boolean().optional(),
    displayOrder: zod_1.z.number().int().min(0).optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.ImportProcessTypeRowSchema = zod_1.z.object({
    processType: zod_1.z.string().min(1).max(150).trim(),
    processDetails: zod_1.z.string().max(2000).optional(),
    processGroup: zod_1.z.string().max(100).optional(),
    typicalDurationMin: zod_1.z.coerce.number().int().min(1).nullable().optional(),
    requiresCleanRoom: zod_1.z
        .union([zod_1.z.boolean(), zod_1.z.string()])
        .transform((v) => v === true || v === 'true' || v === '1' || v === 'yes')
        .optional(),
    displayOrder: zod_1.z.coerce.number().int().min(0).optional(),
});
exports.ImportProcessTypePayloadSchema = zod_1.z.object({
    rows: zod_1.z.array(exports.ImportProcessTypeRowSchema).min(1).max(500),
});
