import { z } from 'zod';

export const CreateMaintenanceSchema = z.object({
  roomId:                  z.string().uuid('Invalid room ID'),
  maintenanceTypeId:       z.string().uuid('Invalid maintenance type ID'),
  maintenanceStartDatetime: z.string().datetime({ message: 'Invalid ISO datetime', offset: true }),
  reasonForMaintenance:    z.string().min(1, 'Reason is required').max(2000).trim(),
});

export const StopMaintenanceSchema = z.object({
  completionRemarks: z.string().max(2000).trim().optional(),
});

export const ApproveMaintenanceSchema = z.object({
  authorizationRemarks: z.string().max(2000).trim().optional(),
});

export const RejectMaintenanceSchema = z.object({
  authorizationRemarks: z.string().min(1, 'Reason for rejection is required').max(2000).trim(),
});

export type CreateMaintenanceInput  = z.infer<typeof CreateMaintenanceSchema>;
export type StopMaintenanceInput    = z.infer<typeof StopMaintenanceSchema>;
export type ApproveMaintenanceInput = z.infer<typeof ApproveMaintenanceSchema>;
export type RejectMaintenanceInput  = z.infer<typeof RejectMaintenanceSchema>;
