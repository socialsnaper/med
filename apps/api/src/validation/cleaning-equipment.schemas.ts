import { z } from 'zod';

export const CLEANING_TYPES = ['dry', 'wet', 'sanitizing', 'general'] as const;
export type CleaningType = typeof CLEANING_TYPES[number];

export const CreateCleaningEquipmentSchema = z.object({
  equipmentName:            z.string().min(1, 'Name is required').max(150).trim(),
  equipmentDetails:         z.string().max(2000).trim().optional(),
  cleaningType:             z.enum(CLEANING_TYPES).optional(),
  material:                 z.string().max(100).trim().optional(),
  requiresReplacement:      z.boolean().optional(),
  replacementIntervalDays:  z.number().int().min(1).nullable().optional(),
  displayOrder:             z.number().int().min(0).optional(),
  isActive:                 z.boolean().optional(),
});

export const UpdateCleaningEquipmentSchema = z.object({
  equipmentName:            z.string().min(1).max(150).trim().optional(),
  equipmentDetails:         z.string().max(2000).trim().nullable().optional(),
  cleaningType:             z.enum(CLEANING_TYPES).optional(),
  material:                 z.string().max(100).trim().nullable().optional(),
  requiresReplacement:      z.boolean().optional(),
  replacementIntervalDays:  z.number().int().min(1).nullable().optional(),
  displayOrder:             z.number().int().min(0).optional(),
  isActive:                 z.boolean().optional(),
});

/** Single row for CSV import — equipment_code is auto-generated */
export const ImportRowSchema = z.object({
  equipmentName:            z.string().min(1).max(150).trim(),
  equipmentDetails:         z.string().max(2000).optional(),
  cleaningType:             z.enum(CLEANING_TYPES).optional(),
  material:                 z.string().max(100).optional(),
  requiresReplacement:      z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true' || v === '1' || v === 'yes')
    .optional(),
  replacementIntervalDays:  z.coerce.number().int().min(1).nullable().optional(),
  displayOrder:             z.coerce.number().int().min(0).optional(),
});

export const ImportPayloadSchema = z.object({
  rows: z.array(ImportRowSchema).min(1).max(500),
});

export type CreateCleaningEquipmentInput = z.infer<typeof CreateCleaningEquipmentSchema>;
export type UpdateCleaningEquipmentInput = z.infer<typeof UpdateCleaningEquipmentSchema>;
export type ImportRow = z.infer<typeof ImportRowSchema>;
