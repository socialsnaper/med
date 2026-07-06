import { z } from 'zod';

// ── POST /api/users ───────────────────────────────────────────────────────────

export const CreateUserSchema = z.object({
  firstName:     z.string().min(1, 'First name is required').max(100).trim(),
  lastName:      z.string().min(1, 'Last name is required').max(100).trim(),
  email:         z.string().email('Invalid email address').max(255).toLowerCase().trim(),
  roleId:        z.string().uuid('Invalid role ID'),
  employeeCode:  z.string().max(50).trim().optional(),
  dateOfJoining: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// ── PATCH /api/users/:id ──────────────────────────────────────────────────────

export const UpdateUserSchema = z.object({
  firstName:     z.string().min(1, 'First name is required').max(100).trim().optional(),
  lastName:      z.string().min(1, 'Last name is required').max(100).trim().optional(),
  email:         z.string().email('Invalid email address').max(255).toLowerCase().trim().optional(),
  roleId:        z.string().uuid('Invalid role ID').optional(),
  employeeCode:  z.string().max(50).trim().nullable().optional(),
  dateOfJoining: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .nullable()
    .optional()
    .transform((v) => (v ? new Date(v) : v === null ? null : undefined)),
}).refine(
  (d) => Object.keys(d).length > 0,
  { message: 'At least one field must be provided' },
);

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

// ── PATCH /api/users/:id/status ───────────────────────────────────────────────

export const SetUserStatusSchema = z.object({
  is_active: z.boolean({ error: 'is_active is required and must be a boolean' }),
});

export type SetUserStatusInput = z.infer<typeof SetUserStatusSchema>;

