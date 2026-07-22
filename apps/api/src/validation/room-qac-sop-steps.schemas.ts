import { z } from 'zod';

export const QAC_STATUSES = ['pending', 'approved', 'rejected', 'archived'] as const;

export const CreateRoomQacSopStepSchema = z.object({
  cleaningTypeId: z.string().uuid('Invalid cleaning type'),
  stepNumber:     z.number().int().min(1, 'Step number must be ≥ 1'),
  procedureText:  z.string().min(1, 'Procedure is required').max(5000),
  status:         z.enum(QAC_STATUSES).optional(),
});

export const UpdateRoomQacSopStepSchema = z.object({
  stepNumber:    z.number().int().min(1).optional(),
  procedureText: z.string().min(1).max(5000).optional(),
  status:        z.enum(QAC_STATUSES).optional(),
});

export const QacImportRowSchema = z.object({
  cleaningTypeCode: z.string().min(1),
  stepNumber:       z.number().int().min(1),
  procedureText:    z.string().min(1).max(5000),
});

export const QacImportPayloadSchema = z.object({
  rows: z.array(QacImportRowSchema).min(1, 'At least one row is required'),
});

export type CreateRoomQacSopStepInput = z.infer<typeof CreateRoomQacSopStepSchema>;
export type UpdateRoomQacSopStepInput = z.infer<typeof UpdateRoomQacSopStepSchema>;
export type QacImportRow              = z.infer<typeof QacImportRowSchema>;
