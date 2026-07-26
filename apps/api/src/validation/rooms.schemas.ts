import { z } from 'zod';

export const CreateRoomSchema = z.object({
  roomName:    z.string().min(1, 'Room name is required').max(150).trim(),
  roomTypeId:  z.string().uuid('Invalid room type ID').optional(),
  floor:       z.string().max(50).trim().optional(),
  building:    z.string().max(100).trim().optional(),
  roomDetails: z.string().max(2000).trim().optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive:    z.boolean().optional(),
});

export const UpdateRoomSchema = z.object({
  roomName:    z.string().min(1).max(150).trim().optional(),
  roomTypeId:  z.string().uuid().nullable().optional(),
  floor:       z.string().max(50).trim().nullable().optional(),
  building:    z.string().max(100).trim().nullable().optional(),
  roomDetails: z.string().max(2000).trim().nullable().optional(),
  isActive:    z.boolean().optional(),
});

export type CreateRoomInput  = z.infer<typeof CreateRoomSchema>;
export type UpdateRoomInput  = z.infer<typeof UpdateRoomSchema>;
