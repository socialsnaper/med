import { z } from 'zod';

export const CreateFunctionTypeSchema = z.object({
  functionTypeName:      z.string().min(1, 'Name is required').max(100).trim(),
  functionTypeDetails:   z.string().max(2000).trim().optional(),
  canSignOff:            z.boolean().optional(),
  canOperateBatch:       z.boolean().optional(),
  canPerformCleaning:    z.boolean().optional(),
  canPerformMaintenance: z.boolean().optional(),
  displayOrder:          z.number().int().min(0).optional(),
  isActive:              z.boolean().optional(),
});

export const UpdateFunctionTypeSchema = z.object({
  functionTypeName:      z.string().min(1).max(100).trim().optional(),
  functionTypeDetails:   z.string().max(2000).trim().nullable().optional(),
  canSignOff:            z.boolean().optional(),
  canOperateBatch:       z.boolean().optional(),
  canPerformCleaning:    z.boolean().optional(),
  canPerformMaintenance: z.boolean().optional(),
  displayOrder:          z.number().int().min(0).optional(),
  isActive:              z.boolean().optional(),
});

export const ImportFunctionTypeRowSchema = z.object({
  functionTypeName:      z.string().min(1).max(100).trim(),
  functionTypeDetails:   z.string().max(2000).optional(),
  canSignOff:            z.preprocess((v) => v === 'true' || v === true || v === 1, z.boolean()).optional(),
  canOperateBatch:       z.preprocess((v) => v === 'true' || v === true || v === 1, z.boolean()).optional(),
  canPerformCleaning:    z.preprocess((v) => v === 'true' || v === true || v === 1, z.boolean()).optional(),
  canPerformMaintenance: z.preprocess((v) => v === 'true' || v === true || v === 1, z.boolean()).optional(),
  displayOrder:          z.coerce.number().int().min(0).optional(),
});

export const ImportFunctionTypePayloadSchema = z.object({
  rows: z.array(ImportFunctionTypeRowSchema).min(1).max(500),
});

export type CreateFunctionTypeInput  = z.infer<typeof CreateFunctionTypeSchema>;
export type UpdateFunctionTypeInput  = z.infer<typeof UpdateFunctionTypeSchema>;
export type ImportFunctionTypeRow    = z.infer<typeof ImportFunctionTypeRowSchema>;
