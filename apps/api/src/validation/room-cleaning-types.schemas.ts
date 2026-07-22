import { z } from 'zod';

export const DEFAULT_METHODS = ['TypeA', 'TypeB', 'TypeC'] as const;
export type DefaultMethod = typeof DEFAULT_METHODS[number];

export const CreateRoomCleaningTypeSchema = z.object({
  cleaningTypeName:    z.string().min(1, 'Name is required').max(150).trim(),
  cleaningTypeDetails: z.string().max(2000).trim().optional(),
  defaultMethod:       z.enum(DEFAULT_METHODS).optional(),
  displayOrder:        z.number().int().min(0).optional(),
  isActive:            z.boolean().optional(),
});

export const UpdateRoomCleaningTypeSchema = z.object({
  cleaningTypeName:    z.string().min(1).max(150).trim().optional(),
  cleaningTypeDetails: z.string().max(2000).trim().nullable().optional(),
  defaultMethod:       z.enum(DEFAULT_METHODS).nullable().optional(),
  displayOrder:        z.number().int().min(0).optional(),
  isActive:            z.boolean().optional(),
});

export const ImportRowSchema = z.object({
  cleaningTypeName:    z.string().min(1).max(150).trim(),
  cleaningTypeDetails: z.string().max(2000).optional(),
  defaultMethod:       z.enum(DEFAULT_METHODS).optional(),
  displayOrder:        z.coerce.number().int().min(0).optional(),
});

export const ImportPayloadSchema = z.object({
  rows: z.array(ImportRowSchema).min(1).max(500),
});

export type CreateRoomCleaningTypeInput = z.infer<typeof CreateRoomCleaningTypeSchema>;
export type UpdateRoomCleaningTypeInput = z.infer<typeof UpdateRoomCleaningTypeSchema>;
export type RoomCleaningTypeImportRow   = z.infer<typeof ImportRowSchema>;
