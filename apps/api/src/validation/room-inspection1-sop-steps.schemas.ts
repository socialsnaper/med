import { z } from 'zod';

export const INSP1_STATUSES = ['pending', 'approved', 'rejected', 'archived'] as const;

export const CreateRoomInspection1SopStepSchema = z.object({
  cleaningTypeId: z.string().uuid('cleaningTypeId must be a UUID'),
  stepNumber:     z.number().int().min(1),
  procedureText:  z.string().min(1, 'Procedure is required').max(5000).trim(),
  status:         z.enum(INSP1_STATUSES).optional(),
});

export const UpdateRoomInspection1SopStepSchema = z.object({
  stepNumber:    z.number().int().min(1).optional(),
  procedureText: z.string().min(1).max(5000).trim().optional(),
  status:        z.enum(INSP1_STATUSES).optional(),
});

export const Insp1ImportRowSchema = z.object({
  cleaningTypeCode: z.string().min(1).max(20).trim(),
  stepNumber:       z.coerce.number().int().min(1),
  procedureText:    z.string().min(1).max(5000).trim(),
});

export const Insp1ImportPayloadSchema = z.object({
  rows: z.array(Insp1ImportRowSchema).min(1).max(500),
});

export type CreateRoomInspection1SopStepInput = z.infer<typeof CreateRoomInspection1SopStepSchema>;
export type UpdateRoomInspection1SopStepInput = z.infer<typeof UpdateRoomInspection1SopStepSchema>;
export type Insp1ImportRow                    = z.infer<typeof Insp1ImportRowSchema>;
