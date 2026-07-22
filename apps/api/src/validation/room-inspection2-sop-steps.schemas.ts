import { z } from 'zod';

export const INSP2_STATUSES = ['pending', 'approved', 'rejected', 'archived'] as const;

export const CreateRoomInspection2SopStepSchema = z.object({
  cleaningTypeId: z.string().uuid('Invalid cleaning type'),
  stepNumber:     z.number().int().min(1, 'Step number must be ≥ 1'),
  procedureText:  z.string().min(1, 'Procedure is required').max(5000),
  status:         z.enum(INSP2_STATUSES).optional(),
});

export const UpdateRoomInspection2SopStepSchema = z.object({
  stepNumber:    z.number().int().min(1).optional(),
  procedureText: z.string().min(1).max(5000).optional(),
  status:        z.enum(INSP2_STATUSES).optional(),
});

export const Insp2ImportRowSchema = z.object({
  cleaningTypeCode: z.string().min(1),
  stepNumber:       z.number().int().min(1),
  procedureText:    z.string().min(1).max(5000),
});

export const Insp2ImportPayloadSchema = z.object({
  rows: z.array(Insp2ImportRowSchema).min(1, 'At least one row is required'),
});

export type CreateRoomInspection2SopStepInput = z.infer<typeof CreateRoomInspection2SopStepSchema>;
export type UpdateRoomInspection2SopStepInput = z.infer<typeof UpdateRoomInspection2SopStepSchema>;
export type Insp2ImportRow                    = z.infer<typeof Insp2ImportRowSchema>;
