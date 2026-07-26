import { getPrismaClient } from '../../lib/prisma';
import type {
  CreateMaintenanceInput,
  StopMaintenanceInput,
  ApproveMaintenanceInput,
  RejectMaintenanceInput,
} from '../validation/room-maintenance.schemas';

// ── Custom error ───────────────────────────────────────────────────────────────

export class RoomMaintenanceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'ROOM_MAINTENANCE_ERROR',
  ) {
    super(message);
    this.name = 'RoomMaintenanceError';
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MaintenanceLogItem {
  id:                      string;
  slid:                    number;
  roomId:                  string;
  roomName:                string;
  roomCode:                string;
  roomTypeName:            string | null;
  floor:                   string | null;
  building:                string | null;
  maintenanceTypeId:       string;
  maintenanceTypeName:     string;
  maintenanceStartDatetime: Date;
  maintenanceEndDatetime:  Date | null;
  durationMinutes:         number | null;
  reasonForMaintenance:    string;
  status:                  string;
  markedBy:                string;
  markedByName:            string;
  stoppedBy:               string | null;
  stoppedByName:           string | null;
  stoppedAt:               Date | null;
  completionRemarks:       string | null;
  authorizedBy:            string | null;
  authorizedByName:        string | null;
  authorizedAt:            Date | null;
  authorizationRemarks:    string | null;
  authorizationStatus:     string;
  createdAt:               Date;
  updatedAt:               Date;
}

export interface MaintenanceTypeItem {
  id:                    string;
  maintenanceTypeCode:   string;
  maintenanceTypeName:   string;
  maintenanceTypeDetails: string | null;
  displayOrder:          number;
  isActive:              boolean;
}

// ── Select projection ──────────────────────────────────────────────────────────

const LOG_SELECT = {
  id: true, slid: true, roomId: true, maintenanceTypeId: true,
  maintenanceStartDatetime: true, maintenanceEndDatetime: true,
  durationMinutes: true, reasonForMaintenance: true, status: true,
  markedBy: true, stoppedBy: true, stoppedAt: true, completionRemarks: true,
  authorizedBy: true, authorizedAt: true, authorizationRemarks: true,
  authorizationStatus: true, createdAt: true, updatedAt: true,
  room: { select: { id: true, roomId: true, roomName: true, floor: true, building: true, roomType: { select: { roomTypeName: true } } } },
  maintenanceType: { select: { maintenanceTypeName: true } },
  markedByUser: { select: { firstName: true, lastName: true } },
  stoppedByUser: { select: { firstName: true, lastName: true } },
  authorizedByUser: { select: { firstName: true, lastName: true } },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLog(row: any): MaintenanceLogItem {
  return {
    id:                      row.id,
    slid:                    row.slid,
    roomId:                  row.roomId,
    roomName:                row.room.roomName,
    roomCode:                row.room.roomId,
    roomTypeName:            row.room.roomType?.roomTypeName ?? null,
    floor:                   row.room.floor ?? null,
    building:                row.room.building ?? null,
    maintenanceTypeId:       row.maintenanceTypeId,
    maintenanceTypeName:     row.maintenanceType.maintenanceTypeName,
    maintenanceStartDatetime: row.maintenanceStartDatetime,
    maintenanceEndDatetime:  row.maintenanceEndDatetime,
    durationMinutes:         row.durationMinutes,
    reasonForMaintenance:    row.reasonForMaintenance,
    status:                  row.status,
    markedBy:                row.markedBy,
    markedByName:            `${row.markedByUser.firstName} ${row.markedByUser.lastName}`,
    stoppedBy:               row.stoppedBy,
    stoppedByName:           row.stoppedByUser
                               ? `${row.stoppedByUser.firstName} ${row.stoppedByUser.lastName}`
                               : null,
    stoppedAt:               row.stoppedAt,
    completionRemarks:       row.completionRemarks,
    authorizedBy:            row.authorizedBy,
    authorizedByName:        row.authorizedByUser
                               ? `${row.authorizedByUser.firstName} ${row.authorizedByUser.lastName}`
                               : null,
    authorizedAt:            row.authorizedAt,
    authorizationRemarks:    row.authorizationRemarks,
    authorizationStatus:     row.authorizationStatus,
    createdAt:               row.createdAt,
    updatedAt:               row.updatedAt,
  };
}

// ── Maintenance Types (lookup) ─────────────────────────────────────────────────

export async function listMaintenanceTypes(schemaName: string): Promise<MaintenanceTypeItem[]> {
  const db = getPrismaClient(schemaName);
  return db.roomMaintenanceType.findMany({
    select: {
      id: true, maintenanceTypeCode: true, maintenanceTypeName: true,
      maintenanceTypeDetails: true, displayOrder: true, isActive: true,
    },
    where: { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { maintenanceTypeName: 'asc' }],
  });
}

// ── List / Get ─────────────────────────────────────────────────────────────────

export async function listMaintenanceLogs(
  schemaName: string,
  opts?: { status?: string; roomId?: string },
): Promise<MaintenanceLogItem[]> {
  const db = getPrismaClient(schemaName);
  const rows = await db.roomMaintenanceLog.findMany({
    select: LOG_SELECT,
    where: {
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.roomId ? { roomId: opts.roomId } : {}),
    },
    orderBy: [{ maintenanceStartDatetime: 'desc' }],
  });
  return rows.map(mapLog);
}

export async function getMaintenanceLog(id: string, schemaName: string): Promise<MaintenanceLogItem> {
  const db  = getPrismaClient(schemaName);
  const row = await db.roomMaintenanceLog.findUnique({ select: LOG_SELECT, where: { id } });
  if (!row) throw new RoomMaintenanceError('Maintenance record not found', 404, 'NOT_FOUND');
  return mapLog(row);
}

// ── Create maintenance ─────────────────────────────────────────────────────────

export async function createMaintenance(
  dto:        CreateMaintenanceInput,
  schemaName: string,
  userId:     string,
  userRole:   string,
  userUsername: string,
  ipAddress?: string,
): Promise<MaintenanceLogItem> {
  const db = getPrismaClient(schemaName);

  // Validation: room must exist and be active
  const room = await db.room.findUnique({
    where: { id: dto.roomId },
    select: { id: true, roomId: true, roomName: true, status: true, isActive: true },
  });
  if (!room) throw new RoomMaintenanceError('Room not found', 404, 'ROOM_NOT_FOUND');
  if (!room.isActive) throw new RoomMaintenanceError('Room is not active', 409, 'ROOM_INACTIVE');
  if (room.status === 'under_maintenance') {
    throw new RoomMaintenanceError(
      'Room is already under maintenance. Stop the current maintenance before starting a new one.',
      409,
      'ALREADY_UNDER_MAINTENANCE',
    );
  }
  if (room.status !== 'active') {
    throw new RoomMaintenanceError(
      `Room is not available (current status: ${room.status})`,
      409,
      'ROOM_UNAVAILABLE',
    );
  }

  // Validation: no active maintenance log already exists for this room
  const activeMaint = await db.roomMaintenanceLog.findFirst({
    where: { roomId: dto.roomId, status: { in: ['active', 'scheduled'] } },
    select: { id: true },
  });
  if (activeMaint) {
    throw new RoomMaintenanceError(
      'An active or scheduled maintenance record already exists for this room.',
      409,
      'DUPLICATE_ACTIVE_MAINTENANCE',
    );
  }

  // Validation: maintenance type must exist
  const maintType = await db.roomMaintenanceType.findUnique({
    where: { id: dto.maintenanceTypeId },
    select: { id: true, maintenanceTypeName: true },
  });
  if (!maintType) throw new RoomMaintenanceError('Maintenance type not found', 404, 'MAINT_TYPE_NOT_FOUND');

  const startDt = new Date(dto.maintenanceStartDatetime);
  const isImmediate = startDt <= new Date();
  const logStatus   = isImmediate ? 'active' : 'scheduled';

  // Create maintenance log + update room status in a transaction
  const result = await db.$transaction(async (tx) => {
    const log = await tx.roomMaintenanceLog.create({
      select: LOG_SELECT,
      data: {
        roomId:                  dto.roomId,
        maintenanceTypeId:       dto.maintenanceTypeId,
        maintenanceStartDatetime: startDt,
        reasonForMaintenance:    dto.reasonForMaintenance,
        status:                  logStatus,
        markedBy:                userId,
        authorizationStatus:     'pending',
        createdBy:               userId,
        updatedBy:               userId,
      },
    });

    // If starting immediately, block the room
    if (isImmediate) {
      await tx.room.update({
        where: { id: dto.roomId },
        data: {
          status:                 'under_maintenance',
          statusReason:           `Maintenance started: ${dto.reasonForMaintenance}`,
          currentMaintenanceLogId: log.id,
          updatedBy:              userId,
        },
      });
    }

    // Audit trail
    await tx.roomMaintenanceAudit.create({
      data: {
        maintenanceLogId:      log.id,
        roomIdSnapshot:        room.id,
        roomNameSnapshot:      room.roomName,
        roomIdCodeSnapshot:    room.roomId,
        action:                'CREATE',
        afterState:            log as object,
        changedFields:         [],
        performedBy:           userId,
        performedByUsername:   userUsername,
        performedByRole:       userRole,
        authorizationStatus:   'pending',
        ipAddress,
      },
    });

    return log;
  });

  return mapLog(result);
}

// ── Stop maintenance ───────────────────────────────────────────────────────────

export async function stopMaintenance(
  id:           string,
  dto:          StopMaintenanceInput,
  schemaName:   string,
  userId:       string,
  userRole:     string,
  userUsername: string,
  ipAddress?:   string,
): Promise<MaintenanceLogItem> {
  const db = getPrismaClient(schemaName);

  const log = await db.roomMaintenanceLog.findUnique({
    select: { id: true, status: true, roomId: true, maintenanceStartDatetime: true },
    where:  { id },
  });
  if (!log) throw new RoomMaintenanceError('Maintenance record not found', 404, 'NOT_FOUND');
  if (log.status !== 'active') {
    throw new RoomMaintenanceError(
      `Cannot stop maintenance — current status is "${log.status}"`,
      409,
      'INVALID_STATUS_TRANSITION',
    );
  }

  const now       = new Date();
  const startMs   = log.maintenanceStartDatetime.getTime();
  const durationMinutes = Math.round((now.getTime() - startMs) / 60000);

  const result = await db.$transaction(async (tx) => {
    const before = await tx.roomMaintenanceLog.findUnique({ select: LOG_SELECT, where: { id } });

    const updated = await tx.roomMaintenanceLog.update({
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

    // Restore room to available (AC8)
    await tx.room.update({
      where: { id: log.roomId },
      data: {
        status:                 'active',
        statusReason:           null,
        currentMaintenanceLogId: null,
        updatedBy:              userId,
      },
    });

    // Audit
    await tx.roomMaintenanceAudit.create({
      data: {
        maintenanceLogId:    id,
        roomIdSnapshot:      updated.room.id,
        roomNameSnapshot:    updated.room.roomName,
        roomIdCodeSnapshot:  updated.room.roomId,
        action:              'STOP',
        beforeState:         before as object,
        afterState:          updated as object,
        changedFields:       ['status', 'maintenance_end_datetime', 'stopped_by', 'stopped_at'],
        performedBy:         userId,
        performedByUsername: userUsername,
        performedByRole:     userRole,
        ipAddress,
      },
    });

    return updated;
  });

  return mapLog(result);
}

// ── Approve maintenance ────────────────────────────────────────────────────────

export async function approveMaintenance(
  id:           string,
  dto:          ApproveMaintenanceInput,
  schemaName:   string,
  userId:       string,
  userRole:     string,
  userUsername: string,
  ipAddress?:   string,
): Promise<MaintenanceLogItem> {
  const db = getPrismaClient(schemaName);

  const log = await db.roomMaintenanceLog.findUnique({
    select: { id: true, authorizationStatus: true, markedBy: true },
    where:  { id },
  });
  if (!log) throw new RoomMaintenanceError('Maintenance record not found', 404, 'NOT_FOUND');
  if (log.authorizationStatus !== 'pending') {
    throw new RoomMaintenanceError(
      `Cannot approve — authorization status is already "${log.authorizationStatus}"`,
      409,
      'INVALID_AUTH_TRANSITION',
    );
  }
  if (log.markedBy === userId) {
    throw new RoomMaintenanceError(
      'A user cannot authorize their own maintenance request.',
      403,
      'SELF_AUTHORIZATION',
    );
  }

  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    const before = await tx.roomMaintenanceLog.findUnique({ select: LOG_SELECT, where: { id } });

    const updated = await tx.roomMaintenanceLog.update({
      select: LOG_SELECT,
      where:  { id },
      data: {
        authorizedBy:         userId,
        authorizedAt:         now,
        authorizationStatus:  'approved',
        authorizationRemarks: dto.authorizationRemarks ?? null,
        updatedBy:            userId,
      },
    });

    await tx.roomMaintenanceAudit.create({
      data: {
        maintenanceLogId:      id,
        roomIdSnapshot:        updated.room.id,
        roomNameSnapshot:      updated.room.roomName,
        roomIdCodeSnapshot:    updated.room.roomId,
        action:                'APPROVE',
        beforeState:           before as object,
        afterState:            updated as object,
        changedFields:         ['authorization_status', 'authorized_by', 'authorized_at'],
        performedBy:           userId,
        performedByUsername:   userUsername,
        performedByRole:       userRole,
        authorizedBy:          userId,
        authorizedByUsername:  userUsername,
        authorizedByRole:      userRole,
        authorizationStatus:   'approved',
        remarks:               dto.authorizationRemarks,
        ipAddress,
      },
    });

    return updated;
  });

  return mapLog(result);
}

// ── Reject maintenance ─────────────────────────────────────────────────────────

export async function rejectMaintenance(
  id:           string,
  dto:          RejectMaintenanceInput,
  schemaName:   string,
  userId:       string,
  userRole:     string,
  userUsername: string,
  ipAddress?:   string,
): Promise<MaintenanceLogItem> {
  const db = getPrismaClient(schemaName);

  const log = await db.roomMaintenanceLog.findUnique({
    select: { id: true, authorizationStatus: true, markedBy: true, roomId: true, status: true },
    where:  { id },
  });
  if (!log) throw new RoomMaintenanceError('Maintenance record not found', 404, 'NOT_FOUND');
  if (log.authorizationStatus !== 'pending') {
    throw new RoomMaintenanceError(
      `Cannot reject — authorization status is already "${log.authorizationStatus}"`,
      409,
      'INVALID_AUTH_TRANSITION',
    );
  }
  if (log.markedBy === userId) {
    throw new RoomMaintenanceError(
      'A user cannot reject their own maintenance request.',
      403,
      'SELF_AUTHORIZATION',
    );
  }

  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    const before = await tx.roomMaintenanceLog.findUnique({ select: LOG_SELECT, where: { id } });

    const updated = await tx.roomMaintenanceLog.update({
      select: LOG_SELECT,
      where:  { id },
      data: {
        authorizedBy:         userId,
        authorizedAt:         now,
        authorizationStatus:  'rejected',
        authorizationRemarks: dto.authorizationRemarks,
        status:               'cancelled',
        updatedBy:            userId,
      },
    });

    // If the room was blocked, restore it
    if (log.status === 'active') {
      await tx.room.update({
        where: { id: log.roomId },
        data:  { status: 'active', statusReason: null, currentMaintenanceLogId: null, updatedBy: userId },
      });
    }

    await tx.roomMaintenanceAudit.create({
      data: {
        maintenanceLogId:      id,
        roomIdSnapshot:        updated.room.id,
        roomNameSnapshot:      updated.room.roomName,
        roomIdCodeSnapshot:    updated.room.roomId,
        action:                'REJECT',
        beforeState:           before as object,
        afterState:            updated as object,
        changedFields:         ['authorization_status', 'status'],
        performedBy:           userId,
        performedByUsername:   userUsername,
        performedByRole:       userRole,
        authorizedBy:          userId,
        authorizedByUsername:  userUsername,
        authorizedByRole:      userRole,
        authorizationStatus:   'rejected',
        remarks:               dto.authorizationRemarks,
        ipAddress,
      },
    });

    return updated;
  });

  return mapLog(result);
}
