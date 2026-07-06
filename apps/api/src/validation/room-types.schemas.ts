import { z } from 'zod';

export const CreateRoomTypeSchema = z.object({
  roomTypeName:    z.string().min(1, 'Name is required').max(150).trim(),
  roomTypeDetails: z.string().max(1000).trim().optional(),
  displayOrder:    z.number().int().min(0).optional(),
  isActive:        z.boolean().optional(),
});

export const UpdateRoomTypeSchema = z.object({
  roomTypeName:    z.string().min(1).max(150).trim().optional(),
  roomTypeDetails: z.string().max(1000).trim().nullable().optional(),
  displayOrder:    z.number().int().min(0).optional(),
  isActive:        z.boolean().optional(),
});

export type CreateRoomTypeInput = z.infer<typeof CreateRoomTypeSchema>;
export type UpdateRoomTypeInput = z.infer<typeof UpdateRoomTypeSchema>;
