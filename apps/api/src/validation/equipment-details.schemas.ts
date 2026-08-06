import { z } from 'zod';

export const EQUIPMENT_TYPES = ['fixed', 'movable'] as const;
export type EquipmentType = typeof EQUIPMENT_TYPES[number];

const dateOrNull = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').nullable().optional();

export const CreateEquipmentDetailSchema = z.object({
  equipmentName:      z.string().min(1, 'Name is required').max(150).trim(),
  serialNo:           z.string().max(100).trim().optional(),
  supportedProcesses: z.array(z.string().uuid()).optional(),
  equipmentType:      z.enum(EQUIPMENT_TYPES).optional(),
  manufacturer:       z.string().max(150).trim().optional(),
  purchaseDate:       dateOrNull,
  commissionDate:     dateOrNull,
  decommissionDate:   dateOrNull,
  isActive:           z.boolean().optional(),
});

export const UpdateEquipmentDetailSchema = z.object({
  equipmentName:      z.string().min(1).max(150).trim().optional(),
  serialNo:           z.string().max(100).trim().nullable().optional(),
  supportedProcesses: z.array(z.string().uuid()).optional(),
  equipmentType:      z.enum(EQUIPMENT_TYPES).optional(),
  manufacturer:       z.string().max(150).trim().nullable().optional(),
  purchaseDate:       dateOrNull,
  commissionDate:     dateOrNull,
  decommissionDate:   dateOrNull,
  isActive:           z.boolean().optional(),
});

/** Single row for CSV import */
export const ImportEquipmentDetailRowSchema = z.object({
  equipmentName:    z.string().min(1).max(150).trim(),
  serialNo:         z.string().max(100).trim().optional(),
  equipmentType:    z.enum(EQUIPMENT_TYPES).optional(),
  manufacturer:     z.string().max(150).trim().optional(),
  purchaseDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  commissionDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  decommissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const ImportEquipmentDetailPayloadSchema = z.object({
  rows: z.array(ImportEquipmentDetailRowSchema).min(1).max(500),
});

export type CreateEquipmentDetailInput = z.infer<typeof CreateEquipmentDetailSchema>;
export type UpdateEquipmentDetailInput = z.infer<typeof UpdateEquipmentDetailSchema>;
export type ImportEquipmentDetailRow   = z.infer<typeof ImportEquipmentDetailRowSchema>;
