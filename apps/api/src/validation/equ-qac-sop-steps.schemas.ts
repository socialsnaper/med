import { z } from 'zod';
export const EQU_QAC_STATUSES = ['pending', 'approved', 'rejected', 'archived'] as const;
export const CreateEquQacSopStepSchema = z.object({
  cleaningTypeId: z.string().uuid(), stepNumber: z.number().int().min(1),
  procedureText: z.string().min(1).max(5000), status: z.enum(EQU_QAC_STATUSES).optional(),
});
export const UpdateEquQacSopStepSchema = z.object({
  stepNumber: z.number().int().min(1).optional(),
  procedureText: z.string().min(1).max(5000).optional(),
  status: z.enum(EQU_QAC_STATUSES).optional(),
});
export const EquQacImportRowSchema = z.object({
  cleaningTypeCode: z.string().min(1), stepNumber: z.coerce.number().int().min(1),
  procedureText: z.string().min(1).max(5000),
});
export const EquQacImportPayloadSchema = z.object({ rows: z.array(EquQacImportRowSchema).min(1).max(500) });
export type CreateEquQacSopStepInput = z.infer<typeof CreateEquQacSopStepSchema>;
export type UpdateEquQacSopStepInput = z.infer<typeof UpdateEquQacSopStepSchema>;
export type EquQacImportRow          = z.infer<typeof EquQacImportRowSchema>;
