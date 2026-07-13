import { z } from 'zod';

export const SCALE_TYPES = ['analytical', 'precision', 'industrial', 'moisture', 'other'] as const;
export const SCALE_STATUSES = ['active', 'quarantined', 'under_repair', 'retired'] as const;

export const CreateScaleSchema = z.object({
  scaleNumber:              z.string().min(1, 'Scale number is required').max(50).trim(),
  minRange:                 z.string().max(20).trim().optional().nullable(),
  minRangeGrams:            z.coerce.number().min(0).optional().nullable(),
  maxRange:                 z.string().max(20).trim().optional().nullable(),
  maxRangeGrams:            z.coerce.number().min(0).optional().nullable(),
  capacity:                 z.string().max(20).trim().optional().nullable(),
  capacityGrams:            z.coerce.number().min(0).optional().nullable(),
  leastCount:               z.string().max(20).trim().optional().nullable(),
  leastCountGrams:          z.coerce.number().min(0).optional().nullable(),
  lastVerifiedOn:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  nextVerificationDue:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  verificationIntervalDays: z.number().int().min(1).optional(),
  formVerificationNo:       z.string().max(20).trim().optional().nullable(),
  nextCalibrationDue:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  calibrationIntervalDays:  z.number().int().min(1).optional(),
  formCalibrationNo:        z.string().max(20).trim().optional().nullable(),
  manufacturer:             z.string().max(100).trim().optional().nullable(),
  modelNumber:              z.string().max(100).trim().optional().nullable(),
  scaleType:                z.enum(SCALE_TYPES).optional().nullable(),
  status:                   z.enum(SCALE_STATUSES).optional(),
  statusReason:             z.string().optional().nullable(),
  isActive:                 z.boolean().optional(),
});

export const UpdateScaleSchema = z.object({
  scaleNumber:              z.string().min(1).max(50).trim().optional(),
  minRange:                 z.string().max(20).trim().optional().nullable(),
  minRangeGrams:            z.coerce.number().min(0).optional().nullable(),
  maxRange:                 z.string().max(20).trim().optional().nullable(),
  maxRangeGrams:            z.coerce.number().min(0).optional().nullable(),
  capacity:                 z.string().max(20).trim().optional().nullable(),
  capacityGrams:            z.coerce.number().min(0).optional().nullable(),
  leastCount:               z.string().max(20).trim().optional().nullable(),
  leastCountGrams:          z.coerce.number().min(0).optional().nullable(),
  lastVerifiedOn:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  nextVerificationDue:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  verificationIntervalDays: z.number().int().min(1).optional(),
  formVerificationNo:       z.string().max(20).trim().optional().nullable(),
  nextCalibrationDue:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  calibrationIntervalDays:  z.number().int().min(1).optional(),
  formCalibrationNo:        z.string().max(20).trim().optional().nullable(),
  manufacturer:             z.string().max(100).trim().optional().nullable(),
  modelNumber:              z.string().max(100).trim().optional().nullable(),
  scaleType:                z.enum(SCALE_TYPES).optional().nullable(),
  status:                   z.enum(SCALE_STATUSES).optional(),
  statusReason:             z.string().optional().nullable(),
  isActive:                 z.boolean().optional(),
});

export const ImportScaleRowSchema = z.object({
  scaleNumber:              z.string().min(1).max(50).trim(),
  minRange:                 z.string().max(20).optional().nullable(),
  minRangeGrams:            z.coerce.number().min(0).optional().nullable(),
  maxRange:                 z.string().max(20).optional().nullable(),
  maxRangeGrams:            z.coerce.number().min(0).optional().nullable(),
  capacity:                 z.string().max(20).optional().nullable(),
  capacityGrams:            z.coerce.number().min(0).optional().nullable(),
  leastCount:               z.string().max(20).optional().nullable(),
  leastCountGrams:          z.coerce.number().min(0).optional().nullable(),
  lastVerifiedOn:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  nextVerificationDue:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  verificationIntervalDays: z.coerce.number().int().min(1).optional(),
  formVerificationNo:       z.string().max(20).optional().nullable(),
  nextCalibrationDue:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  calibrationIntervalDays:  z.coerce.number().int().min(1).optional(),
  formCalibrationNo:        z.string().max(20).optional().nullable(),
  manufacturer:             z.string().max(100).optional().nullable(),
  modelNumber:              z.string().max(100).optional().nullable(),
  scaleType:                z.enum(SCALE_TYPES).optional().nullable(),
});

export const ImportScalePayloadSchema = z.object({
  rows: z.array(ImportScaleRowSchema).min(1).max(500),
});

export type CreateScaleInput   = z.infer<typeof CreateScaleSchema>;
export type UpdateScaleInput   = z.infer<typeof UpdateScaleSchema>;
export type ImportScaleRow     = z.infer<typeof ImportScaleRowSchema>;
