import { z } from 'zod';
export const EQU_INSP2_STATUSES = ['pending', 'approved', 'rejected', 'archived'] as const;
export const CreateEquInsp2SopStepSchema = z.object({
  cleaningTypeId: z.string().uuid(), stepNumber: z.number().int().min(1),
  procedureText: z.string().min(1).max(5000), status: z.enum(EQU_INSP2_STATUSES).optional(),
});
export const UpdateEquInsp2SopStepSchema = z.object({
  stepNumber: z.number().int().min(1).optional(),
  procedureText: z.string().min(1).max(5000).optional(),
  status: z.enum(EQU_INSP2_STATUSES).optional(),
});
export const EquInsp2ImportRowSchema = z.object({
  cleaningTypeCode: z.string().min(1), stepNumber: z.coerce.number().int().min(1),
  procedureText: z.string().min(1).max(5000),
});
export const EquInsp2ImportPayloadSchema = z.object({ rows: z.array(EquInsp2ImportRowSchema).min(1).max(500) });
export type CreateEquInsp2SopStepInput = z.infer<typeof CreateEquInsp2SopStepSchema>;
export type UpdateEquInsp2SopStepInput = z.infer<typeof UpdateEquInsp2SopStepSchema>;
export type EquInsp2ImportRow          = z.infer<typeof EquInsp2ImportRowSchema>;
