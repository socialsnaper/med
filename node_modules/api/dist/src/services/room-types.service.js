"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomTypeError = void 0;
exports.listRoomTypes = listRoomTypes;
exports.getRoomType = getRoomType;
exports.createRoomType = createRoomType;
exports.updateRoomType = updateRoomType;
exports.deleteRoomType = deleteRoomType;
exports.streamRoomTypesCsv = streamRoomTypesCsv;
exports.importRoomTypes = importRoomTypes;
const prisma_1 = require("../../lib/prisma");
// ── Custom error ───────────────────────────────────────────────────────────────
class RoomTypeError extends Error {
    statusCode;
    code;
    constructor(message, statusCode = 400, code = 'ROOM_TYPE_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'RoomTypeError';
    }
}
exports.RoomTypeError = RoomTypeError;
// ── ID generator ───────────────────────────────────────────────────────────────
/**
 * Generates the next room_type_id in the format RT-NNN.
 * Looks at ALL existing IDs (including inactive) to avoid reuse.
 */
async function nextRoomTypeId(schemaName) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const rows = await db.roomType.findMany({
        select: { roomTypeId: true },
        orderBy: { roomTypeId: 'desc' },
    });
    let max = 0;
    for (const row of rows) {
        const match = row.roomTypeId.match(/^RT-(\d+)$/);
        if (match) {
            const n = parseInt(match[1], 10);
            if (n > max)
                max = n;
        }
    }
    return `RT-${String(max + 1).padStart(3, '0')}`;
}
// ── Queries ────────────────────────────────────────────────────────────────────
const SELECT = {
    id: true,
    roomTypeId: true,
    roomTypeName: true,
    roomTypeDetails: true,
    displayOrder: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
};
async function listRoomTypes(schemaName, search) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    return db.roomType.findMany({
        select: SELECT,
        where: search
            ? {
                OR: [
                    { roomTypeId: { contains: search, mode: 'insensitive' } },
                    { roomTypeName: { contains: search, mode: 'insensitive' } },
                ],
            }
            : undefined,
        orderBy: [{ displayOrder: 'asc' }, { roomTypeName: 'asc' }],
    });
}
async function getRoomType(id, schemaName) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const row = await db.roomType.findUnique({ select: SELECT, where: { id } });
    if (!row)
        throw new RoomTypeError('Room type not found', 404, 'NOT_FOUND');
    return row;
}
async function createRoomType(dto, schemaName, userId) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    // Unique name check
    const existing = await db.roomType.findFirst({
        where: { roomTypeName: { equals: dto.roomTypeName, mode: 'insensitive' } },
        select: { id: true },
    });
    if (existing) {
        throw new RoomTypeError(`A room type named "${dto.roomTypeName}" already exists`, 409, 'DUPLICATE_NAME');
    }
    const roomTypeId = await nextRoomTypeId(schemaName);
    return db.roomType.create({
        select: SELECT,
        data: {
            roomTypeId,
            roomTypeName: dto.roomTypeName,
            roomTypeDetails: dto.roomTypeDetails ?? null,
            displayOrder: dto.displayOrder ?? 0,
            isActive: dto.isActive ?? true,
            createdBy: userId,
            updatedBy: userId,
        },
    });
}
async function updateRoomType(id, dto, schemaName, userId) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const existing = await db.roomType.findUnique({ where: { id }, select: { id: true } });
    if (!existing)
        throw new RoomTypeError('Room type not found', 404, 'NOT_FOUND');
    // Unique name check (excluding self)
    if (dto.roomTypeName) {
        const clash = await db.roomType.findFirst({
            where: {
                roomTypeName: { equals: dto.roomTypeName, mode: 'insensitive' },
                NOT: { id },
            },
            select: { id: true },
        });
        if (clash) {
            throw new RoomTypeError(`A room type named "${dto.roomTypeName}" already exists`, 409, 'DUPLICATE_NAME');
        }
    }
    return db.roomType.update({
        select: SELECT,
        where: { id },
        data: {
            ...(dto.roomTypeName !== undefined && { roomTypeName: dto.roomTypeName }),
            ...(dto.roomTypeDetails !== undefined && { roomTypeDetails: dto.roomTypeDetails }),
            ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            updatedBy: userId,
            updatedAt: new Date(),
        },
    });
}
async function deleteRoomType(id, schemaName) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const existing = await db.roomType.findUnique({ where: { id }, select: { id: true } });
    if (!existing)
        throw new RoomTypeError('Room type not found', 404, 'NOT_FOUND');
    await db.roomType.delete({ where: { id } });
}
// ── CSV helpers ────────────────────────────────────────────────────────────────
function csvCell(v) {
    if (v === null || v === undefined)
        return '""';
    return `"${String(v).replace(/"/g, '""')}"`;
}
function csvRow(cells) {
    return cells.map(csvCell).join(',');
}
// ── Export ─────────────────────────────────────────────────────────────────────
async function streamRoomTypesCsv(schemaName, res) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const rows = await db.roomType.findMany({
        select: SELECT,
        orderBy: [{ displayOrder: 'asc' }, { roomTypeName: 'asc' }],
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="room_types.csv"');
    res.write(csvRow(['room_type_id', 'room_type_name', 'room_type_details', 'display_order', 'is_active']) + '\n');
    for (const r of rows) {
        res.write(csvRow([r.roomTypeId, r.roomTypeName, r.roomTypeDetails, r.displayOrder, r.isActive]) + '\n');
    }
    res.end();
}
async function importRoomTypes(rows, schemaName, userId) {
    const result = { created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
            await createRoomType({ roomTypeName: row.roomTypeName, roomTypeDetails: row.roomTypeDetails, displayOrder: row.displayOrder }, schemaName, userId);
            result.created++;
        }
        catch (err) {
            if (err instanceof RoomTypeError && err.code === 'DUPLICATE_NAME')
                result.skipped++;
            else
                result.errors.push({ row: i + 1, message: err instanceof Error ? err.message : 'Unknown error' });
        }
    }
    return result;
}
