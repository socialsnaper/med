"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportRoomTypePayloadSchema = exports.ImportRoomTypeRowSchema = exports.UpdateRoomTypeSchema = exports.CreateRoomTypeSchema = void 0;
const zod_1 = require("zod");
exports.CreateRoomTypeSchema = zod_1.z.object({
    roomTypeName: zod_1.z.string().min(1, 'Name is required').max(150).trim(),
    roomTypeDetails: zod_1.z.string().max(1000).trim().optional(),
    displayOrder: zod_1.z.number().int().min(0).optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.UpdateRoomTypeSchema = zod_1.z.object({
    roomTypeName: zod_1.z.string().min(1).max(150).trim().optional(),
    roomTypeDetails: zod_1.z.string().max(1000).trim().nullable().optional(),
    displayOrder: zod_1.z.number().int().min(0).optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.ImportRoomTypeRowSchema = zod_1.z.object({
    roomTypeName: zod_1.z.string().min(1).max(150).trim(),
    roomTypeDetails: zod_1.z.string().max(1000).optional(),
    displayOrder: zod_1.z.coerce.number().int().min(0).optional(),
});
exports.ImportRoomTypePayloadSchema = zod_1.z.object({
    rows: zod_1.z.array(exports.ImportRoomTypeRowSchema).min(1).max(500),
});
