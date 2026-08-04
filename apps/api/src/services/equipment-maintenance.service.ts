import { getPrismaClient } from '../../lib/prisma';
import type {
  CreateEquipmentMaintenanceInput,
  StopEquipmentMaintenanceInput,
  ApproveEquipmentMaintenanceInput,
  RejectEquipmentMaintenanceInput,
} from '../validation/equipment-maintenance.schemas';

// ── Custom error ───────────────────────────────────────────────────────────────

export class EquipmentMaintenanceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'EQUIPMENT_MAINTENANCE_ERROR',
  ) {
    super(message);
    this.name = 'EquipmentMaintenanceError';
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EquipmentMaintenanceLogItem {
  id:                       string;
  slid:                     number;
  equipmentId:              string;
  equipmentCode:            string;
  equipmentName:            string;
  equipmentType:            string;   // cleaningType
  location:                 string | null;
  manufacturer:             string | null;
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

export interface EquipmentMaintenanceTypeItem {
  id:                    string;
  maintenanceTypeCode:   string;
  maintenanceTypeName:   string;
  maintenanceTypeDetails: string | null;
  displayOrder:          number;
  isActive:              boolean;
}

export interface EquipmentItem {
  id:           string;
  equipmentCode: string;
  equipmentName: string;
  equipmentType: string;
  location:     string | null;
  manufacturer: string | null;
  isActive:     boolean;
  status:       string;
}

// ── Select projection ──────────────────────────────────────────────────────────

const LOG_SELECT = {
  id: true, slid: true, equipmentId: true, maintenanceTypeId: true,
  maintenanceStartDatetime: true, maintenanceEndDatetime: true,
  durationMinutes: true, reasonForMaintenance: true, status: true,
  markedBy: true, stoppedBy: true, stoppedAt: true, completionRemarks: true,
  authorizedBy: true, authorizedAt: true, authorizationRemarks: true,
  authorizationStatus: true, createdAt: true, updatedAt: true,
  equipment: {
    select: {
      id: true, equipmentCode: true, equipmentName: true,
      cleaningType: true, location: true, manufacturer: true,
    },
  },
  maintenanceType: { select: { maintenanceTypeName: true } },
  markedByUser:    { select: { firstName: true, lastName: true } },
  stoppedByUser:   { select: { firstName: true, lastName: true } },
  authorizedByUser: { select: { firstName: true, lastName: true } },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLog(row: any): EquipmentMaintenanceLogItem {
  return {
    id:                       row.id,
    slid:                     row.slid,
    equipmentId:              row.equipmentId,
    equipmentCode:            row.equipment.equipmentCode,
    equipmentName:            row.equipment.equipmentName,
    equipmentType:            row.equipment.cleaningType,
    location:                 row.equipment.location ?? null,
    manufacturer:             row.equipment.manufacturer ?? null,
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

export async function listEquipmentMaintenanceTypes(
  schemaName: string,
): Promise<EquipmentMaintenanceTypeItem[]> {
  const db = getPrismaClient(schemaName);
  return db.equipmentMaintenanceType.findMany({
    select: {
      id: true, maintenanceTypeCode: true, maintenanceTypeName: true,
      maintenanceTypeDetails: true, displayOrder: true, isActive: true,
    },
    where:   { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { maintenanceTypeName: 'asc' }],
  });
}

// ── Equipment list (for "select equipment" dropdown) ──────────────────────────

export async function listEquipment(schemaName: string): Promise<EquipmentItem[]> {
  const db = getPrismaClient(schemaName);
  const rows = await db.cleaningEquipment.findMany({
    select: {
      id: true, equipmentCode: true, equipmentName: true,
      cleaningType: true, location: true, manufacturer: true,
      isActive: true, status: true,
    },
    where:   { isActive: true },
    orderBy: [{ equipmentName: 'asc' }],
  });
  return rows.map((r) => ({
    id:           r.id,
    equipmentCode: r.equipmentCode,
    equipmentName: r.equipmentName,
    equipmentType: r.cleaningType,
    location:     (r as any).location ?? null,
    manufacturer: (r as any).manufacturer ?? null,
    isActive:     r.isActive,
    status:       (r as any).status ?? 'active',
  }));
}

// ── List / Get ─────────────────────────────────────────────────────────────────

export async function listEquipmentMaintenanceLogs(
  schemaName: string,
  opts?: { status?: string; equipmentId?: string; userRole?: string },
): Promise<EquipmentMaintenanceLogItem[]> {
  const db = getPrismaClient(schemaName);

  // Warehouse Operator and Maintenance Technician only see approved + scheduled/active/stopped records.
  const restrictedRoles = ['Warehouse Operator', 'Maintenance Technician'];
  const roleFilter = restrictedRoles.includes(opts?.userRole ?? '')
    ? {
        OR: [
          { authorizationStatus: 'approved', status: { in: ['scheduled', 'active'] as string[] } },
          { status: 'stopped' as string, authorizationStatus: 'approved' },
        ],
      }
    : {};

  const rows = await db.equipmentMaintenanceLog.findMany({
    select: LOG_SELECT,
    where: {
      ...roleFilter,
      ...(opts?.status      ? { status:      opts.status }      : {}),
      ...(opts?.equipmentId ? { equipmentId: opts.equipmentId } : {}),
    },
    orderBy: [{ maintenanceStartDatetime: 'desc' }],
  });
  return rows.map(mapLog);
}

export async function getEquipmentMaintenanceLog(
  id: string,
  schemaName: string,
): Promise<EquipmentMaintenanceLogItem> {
  const db  = getPrismaClient(schemaName);
  const row = await db.equipmentMaintenanceLog.findUnique({ select: LOG_SELECT, where: { id } });
  if (!row) throw new EquipmentMaintenanceError('Maintenance record not found', 404, 'NOT_FOUND');
  return mapLog(row);
}

// ── Create maintenance ─────────────────────────────────────────────────────────

export async function createEquipmentMaintenance(
  dto:          CreateEquipmentMaintenanceInput,
  schemaName:   string,
  userId:       string,
  userRole:     string,
  userUsername: string,
  ipAddress?:   string,
): Promise<EquipmentMaintenanceLogItem> {
  if (userRole !== 'User Admin') {
    throw new EquipmentMaintenanceError(
      'Only users with the "User Admin" role can create maintenance records.',
      403,
      'FORBIDDEN_ROLE',
    );
  }

  const db = getPrismaClient(schemaName);

  const equipment = await db.cleaningEquipment.findUnique({
    where:  { id: dto.equipmentId },
    select: { id: true, equipmentCode: true, equipmentName: true, isActive: true, status: true },
  });
  if (!equipment) throw new EquipmentMaintenanceError('Equipment not found', 404, 'EQUIPMENT_NOT_FOUND');
  if (!equipment.isActive) throw new EquipmentMaintenanceError('Equipment is not active', 409, 'EQUIPMENT_INACTIVE');
  if ((equipment as any).status === 'under_maintenance') {
    throw new EquipmentMaintenanceError(
      'Equipment is already under maintenance. Stop the current maintenance before starting a new one.',
      409,
      'ALREADY_UNDER_MAINTENANCE',
    );
  }

  const activeMaint = await db.equipmentMaintenanceLog.findFirst({
    where:  { equipmentId: dto.equipmentId, status: { in: ['active', 'scheduled'] } },
    select: { id: true },
  });
  if (activeMaint) {
    throw new EquipmentMaintenanceError(
      'An active or scheduled maintenance record already exists for this equipment.',
      409,
      'DUPLICATE_ACTIVE_MAINTENANCE',
    );
  }

  const maintType = await db.equipmentMaintenanceType.findUnique({
    where:  { id: dto.maintenanceTypeId },
    select: { id: true, maintenanceTypeName: true },
  });
  if (!maintType) throw new EquipmentMaintenanceError('Maintenance type not found', 404, 'MAINT_TYPE_NOT_FOUND');

  const startDt = new Date(dto.maintenanceStartDatetime);

  const result = await db.$transaction(async (tx) => {
    const log = await tx.equipmentMaintenanceLog.create({
      select: LOG_SELECT,
      data: {
        equipmentId:              dto.equipmentId,
        maintenanceTypeId:        dto.maintenanceTypeId,
        maintenanceStartDatetime: startDt,
        reasonForMaintenance:     dto.reasonForMaintenance,
        status:                   'scheduled',
        markedBy:                 userId,
        authorizationStatus:      'pending',
        createdBy:                userId,
        updatedBy:                userId,
      } as any,
    });

    // Block the equipment immediately
    await tx.cleaningEquipment.update({
      where: { id: dto.equipmentId },
      data: {
        status:                 'under_maintenance',
        statusReason:           `Maintenance requested: ${dto.reasonForMaintenance}`,
        currentMaintenanceLogId: log.id,
        updatedBy:              userId,
      } as any,
    });

    // Audit trail
    await tx.equipmentMaintenanceAudit.create({
      data: {
        maintenanceLogId:       log.id,
        equipmentIdSnapshot:    equipment.id,
        equipmentNameSnapshot:  equipment.equipmentName,
        equipmentCodeSnapshot:  equipment.equipmentCode,
        action:                 'CREATE',
        afterState:             log as object,
        changedFields:          [],
        performedBy:            userId,
        performedByUsername:    userUsername,
        performedByRole:        userRole,
        authorizationStatus:    'pending',
        ipAddress,
      },
    });

    return log;
  });

  // Notify System Administrators
  try {
    const sysAdmins = await db.user.findMany({
      where:  { isActive: true, role: { roleName: 'System Administrator' } },
      select: { id: true },
    });
    if (sysAdmins.length > 0) {
      await db.inAppNotification.createMany({
        data: sysAdmins.map((u) => ({
          recipientId: u.id,
          title:       'Equipment Maintenance Request',
          message:     `${userUsername} has requested maintenance for equipment "${equipment.equipmentName}". Please review and approve or reject.`,
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

// ── Start maintenance (Warehouse Operator) ────────────────────────────────────

export async function startEquipmentMaintenance(
  id:           string,
  schemaName:   string,
  userId:       string,
  userRole:     string,
  userUsername: string,
  ipAddress?:   string,
): Promise<EquipmentMaintenanceLogItem> {
  if (userRole !== 'Warehouse Operator' && userRole !== 'Maintenance Technician') {
    throw new EquipmentMaintenanceError(
      'Only users with the "Warehouse Operator" or "Maintenance Technician" role can start maintenance.',
      403,
      'FORBIDDEN_ROLE',
    );
  }

  const db = getPrismaClient(schemaName);

  const log = await db.equipmentMaintenanceLog.findUnique({
    select: { id: true, status: true, authorizationStatus: true, equipmentId: true },
    where:  { id },
  });
  if (!log) throw new EquipmentMaintenanceError('Maintenance record not found', 404, 'NOT_FOUND');
  if (log.authorizationStatus !== 'approved') {
    throw new EquipmentMaintenanceError(
      'Maintenance has not been approved yet. Awaiting System Administrator approval.',
      409,
      'NOT_APPROVED',
    );
  }
  if (log.status !== 'scheduled') {
    throw new EquipmentMaintenanceError(
      `Cannot start maintenance — current status is "${log.status}"`,
      409,
      'INVALID_STATUS_TRANSITION',
    );
  }

  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    const before = await tx.equipmentMaintenanceLog.findUnique({ select: LOG_SELECT, where: { id } });

    const updated = await tx.equipmentMaintenanceLog.update({
      select: LOG_SELECT,
      where:  { id },
      data: {
        status:                   'active',
        maintenanceStartDatetime: now,
        updatedBy:                userId,
      },
    });

    await tx.equipmentMaintenanceAudit.create({
      data: {
        maintenanceLogId:       id,
        equipmentIdSnapshot:    updated.equipment.id,
        equipmentNameSnapshot:  updated.equipment.equipmentName,
        equipmentCodeSnapshot:  updated.equipment.equipmentCode,
        action:                 'START',
        beforeState:            before as object,
        afterState:             updated as object,
        changedFields:          ['status', 'maintenance_start_datetime'],
        performedBy:            userId,
        performedByUsername:    userUsername,
        performedByRole:        userRole,
        ipAddress,
      },
    });

    return updated;
  });

  return mapLog(result);
}

// ── Stop maintenance ───────────────────────────────────────────────────────────

export async function stopEquipmentMaintenance(
  id:           string,
  dto:          StopEquipmentMaintenanceInput,
  schemaName:   string,
  userId:       string,
  userRole:     string,
  userUsername: string,
  ipAddress?:   string,
): Promise<EquipmentMaintenanceLogItem> {
  if (userRole !== 'Warehouse Operator' && userRole !== 'Maintenance Technician') {
    throw new EquipmentMaintenanceError(
      'Only users with the "Warehouse Operator" or "Maintenance Technician" role can stop maintenance.',
      403,
      'FORBIDDEN_ROLE',
    );
  }

  const db = getPrismaClient(schemaName);

  const log = await db.equipmentMaintenanceLog.findUnique({
    select: { id: true, status: true, equipmentId: true, maintenanceStartDatetime: true },
    where:  { id },
  });
  if (!log) throw new EquipmentMaintenanceError('Maintenance record not found', 404, 'NOT_FOUND');
  if (log.status !== 'active') {
    throw new EquipmentMaintenanceError(
      `Cannot stop maintenance — current status is "${log.status}"`,
      409,
      'INVALID_STATUS_TRANSITION',
    );
  }

  const now             = new Date();
  const durationMinutes = Math.round((now.getTime() - log.maintenanceStartDatetime.getTime()) / 60000);

  const result = await db.$transaction(async (tx) => {
    const before = await tx.equipmentMaintenanceLog.findUnique({ select: LOG_SELECT, where: { id } });

    const updated = await tx.equipmentMaintenanceLog.update({
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

    // Restore equipment to active
    await tx.cleaningEquipment.update({
      where: { id: log.equipmentId },
      data: {
        status:                  'active',
        statusReason:            null,
        currentMaintenanceLogId: null,
        updatedBy:               userId,
      } as any,
    });

    await tx.equipmentMaintenanceAudit.create({
      data: {
        maintenanceLogId:       id,
        equipmentIdSnapshot:    updated.equipment.id,
        equipmentNameSnapshot:  updated.equipment.equipmentName,
        equipmentCodeSnapshot:  updated.equipment.equipmentCode,
        action:                 'STOP',
        beforeState:            before as object,
        afterState:             updated as object,
        changedFields:          ['status', 'maintenance_end_datetime', 'stopped_by', 'stopped_at'],
        performedBy:            userId,
        performedByUsername:    userUsername,
        performedByRole:        userRole,
        ipAddress,
      },
    });

    return updated;
  });

  // Notify User Admins
  try {
    const equipmentName = result.equipment.equipmentName;
    const userAdmins = await db.user.findMany({
      where:  { isActive: true, role: { roleName: 'User Admin' } },
      select: { id: true },
    });
    if (userAdmins.length > 0) {
      await db.inAppNotification.createMany({
        data: userAdmins.map((u) => ({
          recipientId: u.id,
          title:       'Equipment Maintenance Completed',
          message:     `Warehouse Operator ${userUsername} has completed maintenance on equipment "${equipmentName}". The equipment is now active.`,
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

export async function approveEquipmentMaintenance(
  id:           string,
  dto:          ApproveEquipmentMaintenanceInput,
  schemaName:   string,
  userId:       string,
  userRole:     string,
  userUsername: string,
  ipAddress?:   string,
): Promise<EquipmentMaintenanceLogItem> {
  if (userRole !== 'System Administrator') {
    throw new EquipmentMaintenanceError(
      'Only users with the "System Administrator" role can approve maintenance.',
      403,
      'FORBIDDEN_ROLE',
    );
  }

  const db = getPrismaClient(schemaName);

  const log = await db.equipmentMaintenanceLog.findUnique({
    select: { id: true, status: true, authorizationStatus: true },
    where:  { id },
  });
  if (!log) throw new EquipmentMaintenanceError('Maintenance record not found', 404, 'NOT_FOUND');
  if (log.authorizationStatus !== 'pending') {
    throw new EquipmentMaintenanceError(
      `Cannot approve — authorization status is already "${log.authorizationStatus}"`,
      409,
      'INVALID_AUTH_TRANSITION',
    );
  }
  if (log.status === 'cancelled') {
    throw new EquipmentMaintenanceError('Cannot approve a cancelled record', 409, 'CANCELLED');
  }

  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    const before = await tx.equipmentMaintenanceLog.findUnique({ select: LOG_SELECT, where: { id } });

    const updated = await tx.equipmentMaintenanceLog.update({
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

    await tx.equipmentMaintenanceAudit.create({
      data: {
        maintenanceLogId:       id,
        equipmentIdSnapshot:    updated.equipment.id,
        equipmentNameSnapshot:  updated.equipment.equipmentName,
        equipmentCodeSnapshot:  updated.equipment.equipmentCode,
        action:                 'APPROVE',
        beforeState:            before as object,
        afterState:             updated as object,
        changedFields:          ['authorization_status', 'authorized_by', 'authorized_at'],
        performedBy:            userId,
        performedByUsername:    userUsername,
        performedByRole:        userRole,
        authorizationStatus:    'approved',
        ipAddress,
      },
    });

    return updated;
  });

  // Notify Maintenance Technicians and Warehouse Operators that a task is ready
  try {
    const equipmentName = result.equipment.equipmentName;
    const workers = await db.user.findMany({
      where:  { isActive: true, role: { roleName: { in: ['Maintenance Technician', 'Warehouse Operator'] } } },
      select: { id: true },
    });
    if (workers.length > 0) {
      await db.inAppNotification.createMany({
        data: workers.map((u) => ({
          recipientId: u.id,
          title:       'Maintenance Approved — Action Required',
          message:     `Equipment maintenance for "${equipmentName}" has been approved. Please start the maintenance at your earliest convenience.`,
          type:        'maintenance_approved',
          relatedId:   result.id,
        })),
      });
    }
  } catch (notifErr) {
    console.error('[Notification] Failed to notify maintenance workers:', notifErr);
  }

  return mapLog(result);
}

// ── Reject maintenance ─────────────────────────────────────────────────────────

export async function rejectEquipmentMaintenance(
  id:           string,
  dto:          RejectEquipmentMaintenanceInput,
  schemaName:   string,
  userId:       string,
  userRole:     string,
  userUsername: string,
  ipAddress?:   string,
): Promise<EquipmentMaintenanceLogItem> {
  if (userRole !== 'System Administrator') {
    throw new EquipmentMaintenanceError(
      'Only users with the "System Administrator" role can reject maintenance.',
      403,
      'FORBIDDEN_ROLE',
    );
  }

  const db = getPrismaClient(schemaName);

  const log = await db.equipmentMaintenanceLog.findUnique({
    select: { id: true, status: true, authorizationStatus: true, equipmentId: true },
    where:  { id },
  });
  if (!log) throw new EquipmentMaintenanceError('Maintenance record not found', 404, 'NOT_FOUND');
  if (log.authorizationStatus !== 'pending') {
    throw new EquipmentMaintenanceError(
      `Cannot reject — authorization status is already "${log.authorizationStatus}"`,
      409,
      'INVALID_AUTH_TRANSITION',
    );
  }
  if (log.status === 'cancelled') {
    throw new EquipmentMaintenanceError('Cannot reject a cancelled record', 409, 'CANCELLED');
  }

  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    const before = await tx.equipmentMaintenanceLog.findUnique({ select: LOG_SELECT, where: { id } });

    const updated = await tx.equipmentMaintenanceLog.update({
      select: LOG_SELECT,
      where:  { id },
      data: {
        status:               'cancelled',
        authorizationStatus:  'rejected',
        authorizedBy:         userId,
        authorizedAt:         now,
        authorizationRemarks: dto.authorizationRemarks,
        updatedBy:            userId,
      },
    });

    // Restore equipment to active on rejection
    await tx.cleaningEquipment.update({
      where: { id: log.equipmentId },
      data: {
        status:                  'active',
        statusReason:            null,
        currentMaintenanceLogId: null,
        updatedBy:               userId,
      } as any,
    });

    await tx.equipmentMaintenanceAudit.create({
      data: {
        maintenanceLogId:       id,
        equipmentIdSnapshot:    updated.equipment.id,
        equipmentNameSnapshot:  updated.equipment.equipmentName,
        equipmentCodeSnapshot:  updated.equipment.equipmentCode,
        action:                 'REJECT',
        beforeState:            before as object,
        afterState:             updated as object,
        changedFields:          ['status', 'authorization_status', 'authorized_by', 'authorized_at'],
        performedBy:            userId,
        performedByUsername:    userUsername,
        performedByRole:        userRole,
        authorizationStatus:    'rejected',
        ipAddress,
      },
    });

    return updated;
  });

  return mapLog(result);
}
