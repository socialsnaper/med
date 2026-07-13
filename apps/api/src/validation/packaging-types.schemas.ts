import { z } from 'zod';

export const PACKAGING_CATEGORIES = [
  'blister', 'bottle', 'sachet', 'strip', 'vial', 'ampoule', 'tube', 'pouch', 'other',
] as const;

export const CreatePackagingTypeSchema = z.object({
  packagingTypeName:    z.string().min(1, 'Name is required').max(150).trim(),
  packagingTypeDetails: z.string().max(2000).trim().optional(),
  packagingCategory:    z.enum(PACKAGING_CATEGORIES).optional(),
  primaryMaterial:      z.string().max(100).trim().optional(),
  packUnit:             z.string().max(50).trim().optional(),
  standardPackSize:     z.number().int().positive().optional(),
  storageConditions:    z.string().max(150).trim().optional(),
  displayOrder:         z.number().int().min(0).optional(),
  isActive:             z.boolean().optional(),
});

export const UpdatePackagingTypeSchema = z.object({
  packagingTypeName:    z.string().min(1).max(150).trim().optional(),
  packagingTypeDetails: z.string().max(2000).trim().nullable().optional(),
  packagingCategory:    z.enum(PACKAGING_CATEGORIES).nullable().optional(),
  primaryMaterial:      z.string().max(100).trim().nullable().optional(),
  packUnit:             z.string().max(50).trim().nullable().optional(),
  standardPackSize:     z.number().int().positive().nullable().optional(),
  storageConditions:    z.string().max(150).trim().nullable().optional(),
  displayOrder:         z.number().int().min(0).optional(),
  isActive:             z.boolean().optional(),
});

export const ImportPackagingTypeRowSchema = z.object({
  packagingTypeName:    z.string().min(1).max(150).trim(),
  packagingTypeDetails: z.string().max(2000).optional(),
  packagingCategory:    z.enum(PACKAGING_CATEGORIES).optional(),
  primaryMaterial:      z.string().max(100).optional(),
  packUnit:             z.string().max(50).optional(),
  standardPackSize:     z.coerce.number().int().positive().optional(),
  storageConditions:    z.string().max(150).optional(),
  displayOrder:         z.coerce.number().int().min(0).optional(),
});

export const ImportPackagingTypePayloadSchema = z.object({
  rows: z.array(ImportPackagingTypeRowSchema).min(1).max(500),
});

export type CreatePackagingTypeInput  = z.infer<typeof CreatePackagingTypeSchema>;
export type UpdatePackagingTypeInput  = z.infer<typeof UpdatePackagingTypeSchema>;
export type ImportPackagingTypeRow    = z.infer<typeof ImportPackagingTypeRowSchema>;
