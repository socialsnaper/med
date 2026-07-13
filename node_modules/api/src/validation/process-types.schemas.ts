import { z } from 'zod';

export const CreateProcessTypeSchema = z.object({
  processType:          z.string().min(1, 'Process type name is required').max(150).trim(),
  processDetails:       z.string().max(2000).trim().optional(),
  processGroup:         z.string().max(100).trim().optional(),
  typicalDurationMin:   z.number().int().min(1).nullable().optional(),
  requiresCleanRoom:    z.boolean().optional(),
  displayOrder:         z.number().int().min(0).optional(),
  isActive:             z.boolean().optional(),
});

export const UpdateProcessTypeSchema = z.object({
  processType:          z.string().min(1).max(150).trim().optional(),
  processDetails:       z.string().max(2000).trim().nullable().optional(),
  processGroup:         z.string().max(100).trim().nullable().optional(),
  typicalDurationMin:   z.number().int().min(1).nullable().optional(),
  requiresCleanRoom:    z.boolean().optional(),
  displayOrder:         z.number().int().min(0).optional(),
  isActive:             z.boolean().optional(),
});

export const ImportProcessTypeRowSchema = z.object({
  processType:        z.string().min(1).max(150).trim(),
  processDetails:     z.string().max(2000).optional(),
  processGroup:       z.string().max(100).optional(),
  typicalDurationMin: z.coerce.number().int().min(1).nullable().optional(),
  requiresCleanRoom:  z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true' || v === '1' || v === 'yes')
    .optional(),
  displayOrder:       z.coerce.number().int().min(0).optional(),
});

export const ImportProcessTypePayloadSchema = z.object({
  rows: z.array(ImportProcessTypeRowSchema).min(1).max(500),
});

export type CreateProcessTypeInput  = z.infer<typeof CreateProcessTypeSchema>;
export type UpdateProcessTypeInput  = z.infer<typeof UpdateProcessTypeSchema>;
export type ImportProcessTypeRow    = z.infer<typeof ImportProcessTypeRowSchema>;
