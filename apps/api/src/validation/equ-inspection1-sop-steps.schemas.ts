import { z } from 'zod';
export const EQU_INSP1_STATUSES = ['pending', 'approved', 'rejected', 'archived'] as const;
export const CreateEquInsp1SopStepSchema = z.object({
  cleaningTypeId: z.string().uuid(), stepNumber: z.number().int().min(1),
  procedureText: z.string().min(1).max(5000), status: z.enum(EQU_INSP1_STATUSES).optional(),
});
export const UpdateEquInsp1SopStepSchema = z.object({
  stepNumber: z.number().int().min(1).optional(),
  procedureText: z.string().min(1).max(5000).optional(),
  status: z.enum(EQU_INSP1_STATUSES).optional(),
});
export const EquInsp1ImportRowSchema = z.object({
  cleaningTypeCode: z.string().min(1), stepNumber: z.coerce.number().int().min(1),
  procedureText: z.string().min(1).max(5000),
});
export const EquInsp1ImportPayloadSchema = z.object({ rows: z.array(EquInsp1ImportRowSchema).min(1).max(500) });
export type CreateEquInsp1SopStepInput = z.infer<typeof CreateEquInsp1SopStepSchema>;
export type UpdateEquInsp1SopStepInput = z.infer<typeof UpdateEquInsp1SopStepSchema>;
export type EquInsp1ImportRow          = z.infer<typeof EquInsp1ImportRowSchema>;
