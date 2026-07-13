import { z } from 'zod';

export const CreateWeightSchema = z.object({
  weightSerialNo:          z.string().min(1, 'Serial number is required').max(20).trim(),
  standardWeight:          z.string().min(1, 'Standard weight is required').max(20).trim(),
  weightValueGrams:        z.coerce.number().positive('Weight value must be positive'),
  lastCalibratedOn:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().nullable(),
  nextCalibrationDue:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().nullable(),
  calibrationIntervalDays: z.number().int().min(1).optional(),
  toleranceLimit:          z.string().max(20).trim().optional().nullable(),
  toleranceGrams:          z.coerce.number().min(0).optional().nullable(),
  calibrationLab:          z.string().max(150).trim().optional().nullable(),
  certificateNumber:       z.string().max(100).trim().optional().nullable(),
  certificateUrl:          z.string().max(500).url().trim().optional().nullable(),
  material:                z.string().max(100).trim().optional().nullable(),
  accuracyClass:           z.string().max(20).trim().optional().nullable(),
  storageLocation:         z.string().max(150).trim().optional().nullable(),
  isActive:                z.boolean().optional(),
  inactiveReason:          z.string().optional().nullable(),
});

export const UpdateWeightSchema = z.object({
  weightSerialNo:          z.string().min(1).max(20).trim().optional(),
  standardWeight:          z.string().min(1).max(20).trim().optional(),
  weightValueGrams:        z.coerce.number().positive().optional(),
  lastCalibratedOn:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  nextCalibrationDue:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  calibrationIntervalDays: z.number().int().min(1).optional(),
  toleranceLimit:          z.string().max(20).trim().optional().nullable(),
  toleranceGrams:          z.coerce.number().min(0).optional().nullable(),
  calibrationLab:          z.string().max(150).trim().optional().nullable(),
  certificateNumber:       z.string().max(100).trim().optional().nullable(),
  certificateUrl:          z.string().max(500).url().trim().optional().nullable(),
  material:                z.string().max(100).trim().optional().nullable(),
  accuracyClass:           z.string().max(20).trim().optional().nullable(),
  storageLocation:         z.string().max(150).trim().optional().nullable(),
  isActive:                z.boolean().optional(),
  inactiveReason:          z.string().optional().nullable(),
});

export const ImportWeightRowSchema = z.object({
  weightSerialNo:          z.string().min(1).max(20).trim(),
  standardWeight:          z.string().min(1).max(20).trim(),
  weightValueGrams:        z.coerce.number().positive(),
  lastCalibratedOn:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  nextCalibrationDue:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  calibrationIntervalDays: z.coerce.number().int().min(1).optional(),
  toleranceLimit:          z.string().max(20).optional().nullable(),
  material:                z.string().max(100).optional().nullable(),
  accuracyClass:           z.string().max(20).optional().nullable(),
  storageLocation:         z.string().max(150).optional().nullable(),
  calibrationLab:          z.string().max(150).optional().nullable(),
  certificateNumber:       z.string().max(100).optional().nullable(),
});

export const ImportWeightPayloadSchema = z.object({
  rows: z.array(ImportWeightRowSchema).min(1).max(500),
});

export type CreateWeightInput    = z.infer<typeof CreateWeightSchema>;
export type UpdateWeightInput    = z.infer<typeof UpdateWeightSchema>;
export type ImportWeightRow      = z.infer<typeof ImportWeightRowSchema>;
