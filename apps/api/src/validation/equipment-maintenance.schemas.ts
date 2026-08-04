import { z } from 'zod';

export const CreateEquipmentMaintenanceSchema = z.object({
  equipmentId:              z.string().uuid('Invalid equipment ID'),
  maintenanceTypeId:        z.string().uuid('Invalid maintenance type ID'),
  maintenanceStartDatetime: z.string().datetime({ message: 'Invalid ISO datetime', offset: true }),
  reasonForMaintenance:     z.string().min(1, 'Reason is required').max(2000).trim(),
});

export const StopEquipmentMaintenanceSchema = z.object({
  completionRemarks: z.string().max(2000).trim().optional(),
});

export const ApproveEquipmentMaintenanceSchema = z.object({
  authorizationRemarks: z.string().max(2000).trim().optional(),
});

export const RejectEquipmentMaintenanceSchema = z.object({
  authorizationRemarks: z.string().min(1, 'Reason for rejection is required').max(2000).trim(),
});

export type CreateEquipmentMaintenanceInput  = z.infer<typeof CreateEquipmentMaintenanceSchema>;
export type StopEquipmentMaintenanceInput    = z.infer<typeof StopEquipmentMaintenanceSchema>;
export type ApproveEquipmentMaintenanceInput = z.infer<typeof ApproveEquipmentMaintenanceSchema>;
export type RejectEquipmentMaintenanceInput  = z.infer<typeof RejectEquipmentMaintenanceSchema>;
