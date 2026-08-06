import { getPrismaClient } from '../../lib/prisma';
import type {
  CreateScaleMaintenanceInput,
  StopScaleMaintenanceInput,
  ApproveScaleMaintenanceInput,
  RejectScaleMaintenanceInput,
} from '../validation/scale-maintenance.schemas';

// ── Custom error ───────────────────────────────────────────────────────────────

export class ScaleMaintenanceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'SCALE_MAINTENANCE_ERROR',
  ) {
    super(message);
    this.name = 'ScaleMaintenanceError';
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ScaleMaintenanceLogItem {
  id:                       string;
  slid:                     number;
  scaleId:                  string;
  scaleCode:                string;   // scale.scaleId  e.g. SC-001
  scaleName:                string;   // scale.scaleNumber
  capacity:                 string | null;
  scaleStatus:              string;   // current status on the scale record
  maintenanceTypeId:        string;
  maintenanceTypeName:      string;
  maintenanceStartDatetime: Date;
  maintenanceEndDatetime:   Date | null;
  durationMinutes:          number | null;
  reasonForMaintenance:     string;
  status:                   string;
  markedBy:                 string;
  markedByName:             string;
  stoppedBy:                string | null;
  stoppedByName:            string | null;
  stoppedAt:                Date | null;
  completionRemarks:        string | null;
  authorizedBy:             string | null;
  authorizedByName:         string | null;
  authorizedAt:             Date | null;
  authorizationRemarks:     string | null;
  authorizationStatus:      string;
  createdAt:                Date;
  updatedAt:                Date;
}

export interface ScaleMaintenanceTypeItem {
  id:                    string;
  maintenanceTypeCode:   string;
  maintenanceTypeName:   string;
  maintenanceTypeDetails: string | null;
  displayOrder:          number;
  isActive:              boolean;
}

export interface ScaleListItem {
  id:          string;
  scaleCode:   string;   // scaleId field, e.g. SC-001
  scaleName:   string;   // scaleNumber
  capacity:    string | null;
  isActive:    boolean;
  status:      string;
}

// ── Select projection ──────────────────────────────────────────────────────────

const LOG_SELECT = {
  id: true, slid: true, scaleId: true, maintenanceTypeId: true,
  maintenanceStartDatetime: true, maintenanceEndDatetime: true,
  durationMinutes: true, reasonForMaintenance: true, status: true,
  markedBy: true, stoppedBy: true, stoppedAt: true, completionRemarks: true,
  authorizedBy: true, authorizedAt: true, authorizationRemarks: true,
  authorizationStatus: true, createdAt: true, updatedAt: true,
  scale: {
    select: { id: true, scaleId: true, scaleNumber: true, scaleName: true, capacity: true, status: true },
  },
  maintenanceType:  { select: { maintenanceTypeName: true } },
  markedByUser:     { select: { firstName: true, lastName: true } },
  stoppedByUser:    { select: { firstName: true, lastName: true } },
  authorizedByUser: { select: { firstName: true, lastName: true } },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLog(row: any): ScaleMaintenanceLogItem {
  return {
    id:                       row.id,
    slid:                     row.slid,
    scaleId:                  row.scaleId,
    scaleCode:                row.scale.scaleId,
    scaleName:                row.scale.scaleName ?? row.scale.scaleNumber,
    capacity:                 row.scale.capacity ?? null,
    scaleStatus:              row.scale.status,
    maintenanceTypeId:        row.maintenanceTypeId,
    maintenanceTypeName:      row.maintenanceType.maintenanceTypeName,
    maintenanceStartDatetime: row.maintenanceStartDatetime,
    maintenanceEndDatetime:   row.maintenanceEndDatetime,
    durationMinutes:          row.durationMinutes,
    reasonForMaintenance:     row.reasonForMaintenance,
    status:                   row.status,
    markedBy:                 row.markedBy,
    markedByName:             `${row.markedByUser.firstName} ${row.markedByUser.lastName}`,
    stoppedBy:                row.stoppedBy,
    stoppedByName:            row.stoppedByUser
                                ? `${row.stoppedByUser.firstName} ${row.stoppedByUser.lastName}`
                                : null,
    stoppedAt:                row.stoppedAt,
    completionRemarks:        row.completionRemarks,
    authorizedBy:             row.authorizedBy,
    authorizedByName:         row.authorizedByUser
                                ? `${row.authorizedByUser.firstName} ${row.authorizedByUser.lastName}`
                                : null,
    authorizedAt:             row.authorizedAt,
    authorizationRemarks:     row.authorizationRemarks,
    authorizationStatus:      row.authorizationStatus,
    createdAt:                row.createdAt,
    updatedAt:                row.updatedAt,
  };
}

// ── Maintenance Types (lookup) ─────────────────────────────────────────────────

export async function listScaleMaintenanceTypes(
  schemaName: string,
): Promise<ScaleMaintenanceTypeItem[]> {
  const db = getPrismaClient(schemaName);
  return (db as any).scaleMaintenanceType.findMany({
    select: {
      id: true, maintenanceTypeCode: true, maintenanceTypeName: true,
      maintenanceTypeDetails: true, displayOrder: true, isActive: true,
    },
    where:   { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { maintenanceTypeName: 'asc' }],
  });
}

// ── Scale list (for dropdown) ──────────────────────────────────────────────────

export async function listScalesForMaintenance(schemaName: string): Promise<ScaleListItem[]> {
  const db = getPrismaClient(schemaName);
  const rows = await (db as any).scale.findMany({
    select: { id: true, scaleId: true, scaleNumber: true, scaleName: true, capacity: true, isActive: true, status: true },
    where:  { isActive: true },
    orderBy: [{ scaleNumber: 'asc' }],
  });
  return rows.map((r: any) => ({
    id:        r.id,
    scaleCode: r.scaleId,
    scaleName: r.scaleName ?? r.scaleNumber,
    capacity:  r.capacity ?? null,
    isActive:  r.isActive,
    status:    r.status ?? 'active',
  }));
}

// ── List / Get ─────────────────────────────────────────────────────────────────

export async function listScaleMaintenanceLogs(
  schemaName: string,
  opts?: { status?: string; scaleId?: string; userRole?: string },
): Promise<ScaleMaintenanceLogItem[]> {
  const db = getPrismaClient(schemaName);

  const restrictedRoles = ['Maintenance Technician'];
  const roleFilter = restrictedRoles.includes(opts?.userRole ?? '')
    ? {
        OR: [
          { authorizationStatus: 'approved', status: { in: ['scheduled', 'active'] as string[] } },
          { status: 'stopped' as string, authorizationStatus: 'approved' },
        ],
      }
    : {};

  const rows = await (db as any).scaleMaintenanceLog.findMany({
    select: LOG_SELECT,
    where: {
      ...roleFilter,
      ...(opts?.status  ? { status:  opts.status }  : {}),
      ...(opts?.scaleId ? { scaleId: opts.scaleId } : {}),
    },
    orderBy: [{ maintenanceStartDatetime: 'desc' }],
  });
  return rows.map(mapLog);
}

export async function getScaleMaintenanceLog(
  id: string,
  schemaName: string,
): Promise<ScaleMaintenanceLogItem> {
  const db  = getPrismaClient(schemaName);
  const row = await (db as any).scaleMaintenanceLog.findUnique({ select: LOG_SELECT, where: { id } });
  if (!row) throw new ScaleMaintenanceError('Maintenance record not found', 404, 'NOT_FOUND');
  return mapLog(row);
}

// ── Create maintenance ─────────────────────────────────────────────────────────

export async function createScaleMaintenance(
  dto:          CreateScaleMaintenanceInput,
  schemaName:   string,
  userId:       string,
  userRole:     string,
  userUsername: string,
  ipAddress?:   string,
): Promise<ScaleMaintenanceLogItem> {
  if (userRole !== 'User Admin') {
    throw new ScaleMaintenanceError(
      'Only users with the "User Admin" role can create maintenance records.',
      403,
      'FORBIDDEN_ROLE',
    );
  }

  const db = getPrismaClient(schemaName);

  const scale = await (db as any).scale.findUnique({
    where:  { id: dto.scaleId },
    select: { id: true, scaleId: true, scaleNumber: true, isActive: true },
  });
  if (!scale) throw new ScaleMaintenanceError('Scale not found', 404, 'SCALE_NOT_FOUND');
  if (!scale.isActive) throw new ScaleMaintenanceError('Scale is not active', 409, 'SCALE_INACTIVE');

  const activeMaint = await (db as any).scaleMaintenanceLog.findFirst({
    where:  { scaleId: dto.scaleId, status: { in: ['active', 'scheduled'] } },
    select: { id: true },
  });
  if (activeMaint) {
    throw new ScaleMaintenanceError(
      'An active or scheduled maintenance record already exists for this scale.',
      409,
      'DUPLICATE_ACTIVE_MAINTENANCE',
    );
  }

  const maintType = await (db as any).scaleMaintenanceType.findUnique({
    where:  { id: dto.maintenanceTypeId },
    select: { id: true, maintenanceTypeName: true },
  });
  if (!maintType) throw new ScaleMaintenanceError('Maintenance type not found', 404, 'MAINT_TYPE_NOT_FOUND');

  const startDt = new Date(dto.maintenanceStartDatetime);

  const result = await (db as any).$transaction(async (tx: any) => {
    const log = await tx.scaleMaintenanceLog.create({
      select: LOG_SELECT,
      data: {
        scaleId:                  dto.scaleId,
        maintenanceTypeId:        dto.maintenanceTypeId,
        maintenanceStartDatetime: startDt,
        reasonForMaintenance:     dto.reasonForMaintenance,
        status:                   'scheduled',
        markedBy:                 userId,
        authorizationStatus:      'pending',
        createdBy:                userId,
        updatedBy:                userId,
      },
    });

    // Block the scale immediately
    await tx.scale.update({
      where: { id: dto.scaleId },
      data: {
        status:                  'under_repair',
        statusReason:            `Maintenance requested: ${dto.reasonForMaintenance}`,
        currentMaintenanceLogId: log.id,
        updatedBy:               userId,
      },
    });

    return log;
  });

  // Notify System Administrators
  try {
    const sysAdmins = await (db as any).user.findMany({
      where:  { isActive: true, role: { roleName: 'System Administrator' } },
      select: { id: true },
    });
    if (sysAdmins.length > 0) {
      await (db as any).inAppNotification.createMany({
        data: sysAdmins.map((u: any) => ({
          recipientId: u.id,
          title:       'Scale Maintenance Request',
          message:     `${userUsername} has requested maintenance for scale "${scale.scaleNumber}". Please review and approve or reject.`,
          type:        'maintenance_created',
          relatedId:   result.id,
        })),
      });
    }
  } catch (notifErr) {
    console.error('[Notification] Failed to notify System Administrators:', notifErr);
  }

  return mapLog(result);
}

// ── Start maintenance ──────────────────────────────────────────────────────────

export async function startScaleMaintenance(
  id:           string,
  schemaName:   string,
  userId:       string,
  userRole:     string,
  userUsername: string,
  ipAddress?:   string,
): Promise<ScaleMaintenanceLogItem> {
  if (userRole !== 'Maintenance Technician') {
    throw new ScaleMaintenanceError(
      'Only users with the "Maintenance Technician" role can start scale maintenance.',
      403,
      'FORBIDDEN_ROLE',
    );
  }

  const db = getPrismaClient(schemaName);

  const log = await (db as any).scaleMaintenanceLog.findUnique({
    select: { id: true, status: true, authorizationStatus: true, scaleId: true },
    where:  { id },
  });
  if (!log) throw new ScaleMaintenanceError('Maintenance record not found', 404, 'NOT_FOUND');
  if (log.authorizationStatus !== 'approved') {
    throw new ScaleMaintenanceError(
      'Maintenance has not been approved yet. Awaiting System Administrator approval.',
      409,
      'NOT_APPROVED',
    );
  }
  if (log.status !== 'scheduled') {
    throw new ScaleMaintenanceError(
      `Cannot start maintenance — current status is "${log.status}"`,
      409,
      'INVALID_STATUS_TRANSITION',
    );
  }

  const now = new Date();

  const result = await (db as any).$transaction(async (tx: any) => {
    const updated = await tx.scaleMaintenanceLog.update({
      select: LOG_SELECT,
      where:  { id },
      data: {
        status:                   'active',
        maintenanceStartDatetime: now,
        updatedBy:                userId,
      },
    });
    return updated;
  });

  return mapLog(result);
}

// ── Stop maintenance ───────────────────────────────────────────────────────────

export async function stopScaleMaintenance(
  id:           string,
  dto:          StopScaleMaintenanceInput,
  schemaName:   string,
  userId:       string,
  userRole:     string,
  userUsername: string,
  ipAddress?:   string,
): Promise<ScaleMaintenanceLogItem> {
  if (userRole !== 'Maintenance Technician') {
    throw new ScaleMaintenanceError(
      'Only users with the "Maintenance Technician" role can stop scale maintenance.',
      403,
      'FORBIDDEN_ROLE',
    );
  }

  const db = getPrismaClient(schemaName);

  const log = await (db as any).scaleMaintenanceLog.findUnique({
    select: { id: true, status: true, scaleId: true, maintenanceStartDatetime: true },
    where:  { id },
  });
  if (!log) throw new ScaleMaintenanceError('Maintenance record not found', 404, 'NOT_FOUND');
  if (log.status !== 'active') {
    throw new ScaleMaintenanceError(
      `Cannot stop maintenance — current status is "${log.status}"`,
      409,
      'INVALID_STATUS_TRANSITION',
    );
  }

  const now             = new Date();
  const durationMinutes = Math.round((now.getTime() - new Date(log.maintenanceStartDatetime).getTime()) / 60000);

  const result = await (db as any).$transaction(async (tx: any) => {
    const updated = await tx.scaleMaintenanceLog.update({
      select: LOG_SELECT,
      where:  { id },
      data: {
        status:                  'stopped',
        maintenanceEndDatetime:  now,
        durationMinutes,
        stoppedBy:               userId,
        stoppedAt:               now,
        completionRemarks:       dto.completionRemarks ?? null,
        updatedBy:               userId,
      },
    });

    // Restore scale to active
    await tx.scale.update({
      where: { id: log.scaleId },
      data: {
        status:                  'active',
        statusReason:            null,
        currentMaintenanceLogId: null,
        updatedBy:               userId,
      },
    });

    return updated;
  });

  // Notify User Admins
  try {
    const scaleName = result.scale.scaleName ?? result.scale.scaleNumber;
    const userAdmins = await (db as any).user.findMany({
      where:  { isActive: true, role: { roleName: 'User Admin' } },
      select: { id: true },
    });
    if (userAdmins.length > 0) {
      await (db as any).inAppNotification.createMany({
        data: userAdmins.map((u: any) => ({
          recipientId: u.id,
          title:       'Scale Maintenance Completed',
          message:     `Maintenance Technician ${userUsername} has completed maintenance on scale "${scaleName}". The scale is now active.`,
          type:        'maintenance_completed',
          relatedId:   id,
        })),
      });
    }
  } catch (notifErr) {
    console.error('[Notification] Failed to notify User Admins:', notifErr);
  }

  return mapLog(result);
}

// ── Approve maintenance ────────────────────────────────────────────────────────

export async function approveScaleMaintenance(
  id:           string,
  dto:          ApproveScaleMaintenanceInput,
  schemaName:   string,
  userId:       string,
  userRole:     string,
  userUsername: string,
  ipAddress?:   string,
): Promise<ScaleMaintenanceLogItem> {
  if (userRole !== 'System Administrator') {
    throw new ScaleMaintenanceError(
      'Only users with the "System Administrator" role can approve maintenance.',
      403,
      'FORBIDDEN_ROLE',
    );
  }

  const db = getPrismaClient(schemaName);

  const log = await (db as any).scaleMaintenanceLog.findUnique({
    select: { id: true, status: true, authorizationStatus: true },
    where:  { id },
  });
  if (!log) throw new ScaleMaintenanceError('Maintenance record not found', 404, 'NOT_FOUND');
  if (log.authorizationStatus !== 'pending') {
    throw new ScaleMaintenanceError(
      `Cannot approve — authorization status is already "${log.authorizationStatus}"`,
      409,
      'INVALID_AUTH_TRANSITION',
    );
  }
  if (log.status === 'cancelled') {
    throw new ScaleMaintenanceError('Cannot approve a cancelled record', 409, 'CANCELLED');
  }

  const now = new Date();

  const result = await (db as any).$transaction(async (tx: any) => {
    const updated = await tx.scaleMaintenanceLog.update({
      select: LOG_SELECT,
      where:  { id },
      data: {
        authorizationStatus:  'approved',
        authorizedBy:         userId,
        authorizedAt:         now,
        authorizationRemarks: dto.authorizationRemarks ?? null,
        updatedBy:            userId,
      },
    });
    return updated;
  });

  // Notify Maintenance Technicians
  try {
    const scaleName = result.scale.scaleName ?? result.scale.scaleNumber;
    const workers = await (db as any).user.findMany({
      where:  { isActive: true, role: { roleName: 'Maintenance Technician' } },
      select: { id: true },
    });
    if (workers.length > 0) {
      await (db as any).inAppNotification.createMany({
        data: workers.map((u: any) => ({
          recipientId: u.id,
          title:       'Scale Maintenance Approved — Action Required',
          message:     `Scale maintenance for "${scaleName}" has been approved. Please start the maintenance at your earliest convenience.`,
          type:        'maintenance_approved',
          relatedId:   result.id,
        })),
      });
    }
  } catch (notifErr) {
    console.error('[Notification] Failed to notify maintenance technicians:', notifErr);
  }

  return mapLog(result);
}

// ── Reject maintenance ─────────────────────────────────────────────────────────

export async function rejectScaleMaintenance(
  id:           string,
  dto:          RejectScaleMaintenanceInput,
  schemaName:   string,
  userId:       string,
  userRole:     string,
  userUsername: string,
  ipAddress?:   string,
): Promise<ScaleMaintenanceLogItem> {
  if (userRole !== 'System Administrator') {
    throw new ScaleMaintenanceError(
      'Only users with the "System Administrator" role can reject maintenance.',
      403,
      'FORBIDDEN_ROLE',
    );
  }

  const db = getPrismaClient(schemaName);

  const log = await (db as any).scaleMaintenanceLog.findUnique({
    select: { id: true, status: true, authorizationStatus: true, scaleId: true },
    where:  { id },
  });
  if (!log) throw new ScaleMaintenanceError('Maintenance record not found', 404, 'NOT_FOUND');
  if (log.authorizationStatus !== 'pending') {
    throw new ScaleMaintenanceError(
      `Cannot reject — authorization status is already "${log.authorizationStatus}"`,
      409,
      'INVALID_AUTH_TRANSITION',
    );
  }

  const now = new Date();

  const result = await (db as any).$transaction(async (tx: any) => {
    const updated = await tx.scaleMaintenanceLog.update({
      select: LOG_SELECT,
      where:  { id },
      data: {
        authorizationStatus:  'rejected',
        status:               'cancelled',
        authorizedBy:         userId,
        authorizedAt:         now,
        authorizationRemarks: dto.authorizationRemarks,
        updatedBy:            userId,
      },
    });

    // Restore scale to active
    await tx.scale.update({
      where: { id: log.scaleId },
      data: {
        status:                  'active',
        statusReason:            null,
        currentMaintenanceLogId: null,
        updatedBy:               userId,
      },
    });

    return updated;
  });

  return mapLog(result);
}
