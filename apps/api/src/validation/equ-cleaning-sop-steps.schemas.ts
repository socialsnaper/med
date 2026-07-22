import { z } from 'zod';

export const EQU_CLEANING_METHODS = ['TypeA', 'TypeB', 'TypeC'] as const;
export const EQU_SOP_STATUSES     = ['pending', 'approved', 'rejected', 'archived'] as const;

export const CreateEquCleaningSopStepSchema = z.object({
  cleaningTypeId:      z.string().uuid('cleaningTypeId must be a UUID'),
  stepNumber:          z.number().int().min(1),
  timeAllottedDisplay: z.string().max(10).trim().optional(),
  cleaningMethod:      z.enum(EQU_CLEANING_METHODS),
  procedureText:       z.string().min(1, 'Procedure is required').max(5000).trim(),
  chemicalUsed:        z.string().max(200).trim().optional(),
  equipmentUsed:       z.string().max(300).trim().optional(),
  status:              z.enum(EQU_SOP_STATUSES).optional(),
});

export const UpdateEquCleaningSopStepSchema = z.object({
  stepNumber:          z.number().int().min(1).optional(),
  timeAllottedDisplay: z.string().max(10).trim().nullable().optional(),
  cleaningMethod:      z.enum(EQU_CLEANING_METHODS).optional(),
  procedureText:       z.string().min(1).max(5000).trim().optional(),
  chemicalUsed:        z.string().max(200).trim().nullable().optional(),
  equipmentUsed:       z.string().max(300).trim().nullable().optional(),
  status:              z.enum(EQU_SOP_STATUSES).optional(),
});

export const EquSopImportRowSchema = z.object({
  cleaningTypeCode:    z.string().min(1).max(20).trim(),
  stepNumber:          z.coerce.number().int().min(1),
  timeAllottedDisplay: z.string().max(10).optional(),
  cleaningMethod:      z.enum(EQU_CLEANING_METHODS),
  procedureText:       z.string().min(1).max(5000).trim(),
  chemicalUsed:        z.string().max(200).optional(),
  equipmentUsed:       z.string().max(300).optional(),
});

export const EquSopImportPayloadSchema = z.object({
  rows: z.array(EquSopImportRowSchema).min(1).max(500),
});

export type CreateEquCleaningSopStepInput = z.infer<typeof CreateEquCleaningSopStepSchema>;
export type UpdateEquCleaningSopStepInput = z.infer<typeof UpdateEquCleaningSopStepSchema>;
export type EquSopImportRow               = z.infer<typeof EquSopImportRowSchema>;
