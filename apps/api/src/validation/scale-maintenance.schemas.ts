import { z } from 'zod';

export const CreateScaleMaintenanceSchema = z.object({
  scaleId:                  z.string().uuid('Invalid scale ID'),
  maintenanceTypeId:        z.string().uuid('Invalid maintenance type ID'),
  maintenanceStartDatetime: z.string().datetime({ message: 'Invalid ISO datetime', offset: true }),
  reasonForMaintenance:     z.string().min(1, 'Reason is required').max(2000).trim(),
});

export const StopScaleMaintenanceSchema = z.object({
  completionRemarks: z.string().max(2000).trim().optional(),
});

export const ApproveScaleMaintenanceSchema = z.object({
  authorizationRemarks: z.string().max(2000).trim().optional(),
});

export const RejectScaleMaintenanceSchema = z.object({
  authorizationRemarks: z.string().min(1, 'Reason for rejection is required').max(2000).trim(),
});

export type CreateScaleMaintenanceInput  = z.infer<typeof CreateScaleMaintenanceSchema>;
export type StopScaleMaintenanceInput    = z.infer<typeof StopScaleMaintenanceSchema>;
export type ApproveScaleMaintenanceInput = z.infer<typeof ApproveScaleMaintenanceSchema>;
export type RejectScaleMaintenanceInput  = z.infer<typeof RejectScaleMaintenanceSchema>;
