import { z } from 'zod';

export const CLEANING_METHODS  = ['TypeA', 'TypeB', 'TypeC'] as const;
export const EQUIP_SEQUENCES   = ['Before', 'After', 'NA']   as const;
export const SOP_STATUSES      = ['pending', 'approved', 'rejected', 'archived'] as const;

export const CreateRoomCleaningSopStepSchema = z.object({
  cleaningTypeId:            z.string().uuid('cleaningTypeId must be a UUID'),
  stepNumber:                z.number().int().min(1),
  timeAllottedDisplay:       z.string().max(10).trim().optional(),
  cleaningMethod:            z.enum(CLEANING_METHODS),
  equipmentCleaningSequence: z.enum(EQUIP_SEQUENCES).optional(),
  procedureText:             z.string().min(1, 'Procedure is required').max(5000).trim(),
  chemicalUsed:              z.string().max(200).trim().optional(),
  status:                    z.enum(SOP_STATUSES).optional(),
});

export const UpdateRoomCleaningSopStepSchema = z.object({
  stepNumber:                z.number().int().min(1).optional(),
  timeAllottedDisplay:       z.string().max(10).trim().nullable().optional(),
  cleaningMethod:            z.enum(CLEANING_METHODS).optional(),
  equipmentCleaningSequence: z.enum(EQUIP_SEQUENCES).optional(),
  procedureText:             z.string().min(1).max(5000).trim().optional(),
  chemicalUsed:              z.string().max(200).trim().nullable().optional(),
  status:                    z.enum(SOP_STATUSES).optional(),
});

export const SopImportRowSchema = z.object({
  cleaningTypeCode:          z.string().min(1).max(20).trim(),
  stepNumber:                z.coerce.number().int().min(1),
  timeAllottedDisplay:       z.string().max(10).optional(),
  cleaningMethod:            z.enum(CLEANING_METHODS),
  equipmentCleaningSequence: z.enum(EQUIP_SEQUENCES).optional(),
  procedureText:             z.string().min(1).max(5000).trim(),
  chemicalUsed:              z.string().max(200).optional(),
});

export const SopImportPayloadSchema = z.object({
  rows: z.array(SopImportRowSchema).min(1).max(500),
});

export type CreateRoomCleaningSopStepInput = z.infer<typeof CreateRoomCleaningSopStepSchema>;
export type UpdateRoomCleaningSopStepInput = z.infer<typeof UpdateRoomCleaningSopStepSchema>;
export type SopImportRow                   = z.infer<typeof SopImportRowSchema>;
