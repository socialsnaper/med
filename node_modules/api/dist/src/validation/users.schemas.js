"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetUserStatusSchema = exports.UpdateUserSchema = exports.CreateUserSchema = void 0;
const zod_1 = require("zod");
// ── POST /api/users ───────────────────────────────────────────────────────────
exports.CreateUserSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'First name is required').max(100).trim(),
    lastName: zod_1.z.string().min(1, 'Last name is required').max(100).trim(),
    email: zod_1.z.string().email('Invalid email address').max(255).toLowerCase().trim(),
    roleId: zod_1.z.string().uuid('Invalid role ID'),
    employeeCode: zod_1.z.string().max(50).trim().optional(),
    dateOfJoining: zod_1.z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
        .optional()
        .transform((v) => (v ? new Date(v) : undefined)),
});
// ── PATCH /api/users/:id ──────────────────────────────────────────────────────
exports.UpdateUserSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'First name is required').max(100).trim().optional(),
    lastName: zod_1.z.string().min(1, 'Last name is required').max(100).trim().optional(),
    email: zod_1.z.string().email('Invalid email address').max(255).toLowerCase().trim().optional(),
    roleId: zod_1.z.string().uuid('Invalid role ID').optional(),
    employeeCode: zod_1.z.string().max(50).trim().nullable().optional(),
    dateOfJoining: zod_1.z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
        .nullable()
        .optional()
        .transform((v) => (v ? new Date(v) : v === null ? null : undefined)),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });
// ── PATCH /api/users/:id/status ───────────────────────────────────────────────
exports.SetUserStatusSchema = zod_1.z.object({
    is_active: zod_1.z.boolean({ error: 'is_active is required and must be a boolean' }),
});
