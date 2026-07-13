"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessTypeError = void 0;
exports.listProcessTypes = listProcessTypes;
exports.getProcessType = getProcessType;
exports.createProcessType = createProcessType;
exports.updateProcessType = updateProcessType;
exports.deleteProcessType = deleteProcessType;
exports.listProcessGroups = listProcessGroups;
exports.streamProcessTypesCsv = streamProcessTypesCsv;
exports.importProcessTypes = importProcessTypes;
const prisma_1 = require("../../lib/prisma");
// ── Custom error ───────────────────────────────────────────────────────────────
class ProcessTypeError extends Error {
    statusCode;
    code;
    constructor(message, statusCode = 400, code = 'PROCESS_TYPE_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'ProcessTypeError';
    }
}
exports.ProcessTypeError = ProcessTypeError;
// ── ID generator ───────────────────────────────────────────────────────────────
async function nextProcessId(schemaName) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const rows = await db.processType.findMany({
        select: { processId: true },
        orderBy: { processId: 'desc' },
    });
    let max = 0;
    for (const row of rows) {
        const match = row.processId.match(/^PR-(\d+)$/);
        if (match) {
            const n = parseInt(match[1], 10);
            if (n > max)
                max = n;
        }
    }
    return `PR-${String(max + 1).padStart(3, '0')}`;
}
// ── Select projection ──────────────────────────────────────────────────────────
const SELECT = {
    id: true,
    processId: true,
    processType: true,
    processDetails: true,
    processGroup: true,
    typicalDurationMin: true,
    requiresCleanRoom: true,
    displayOrder: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
};
// ── Queries ────────────────────────────────────────────────────────────────────
async function listProcessTypes(schemaName, search, group) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const where = {
        ...(group ? { processGroup: group } : {}),
        ...(search
            ? {
                OR: [
                    { processId: { contains: search, mode: 'insensitive' } },
                    { processType: { contains: search, mode: 'insensitive' } },
                    { processGroup: { contains: search, mode: 'insensitive' } },
                ],
            }
            : {}),
    };
    return db.processType.findMany({
        select: SELECT,
        where,
        orderBy: [{ displayOrder: 'asc' }, { processType: 'asc' }],
    });
}
async function getProcessType(id, schemaName) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const row = await db.processType.findUnique({ select: SELECT, where: { id } });
    if (!row)
        throw new ProcessTypeError('Process type not found', 404, 'NOT_FOUND');
    return row;
}
async function createProcessType(dto, schemaName, userId) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const clash = await db.processType.findFirst({
        where: { processType: { equals: dto.processType, mode: 'insensitive' } },
        select: { id: true },
    });
    if (clash) {
        throw new ProcessTypeError(`A process type named "${dto.processType}" already exists`, 409, 'DUPLICATE_NAME');
    }
    const processId = await nextProcessId(schemaName);
    return db.processType.create({
        select: SELECT,
        data: {
            processId,
            processType: dto.processType,
            processDetails: dto.processDetails ?? null,
            processGroup: dto.processGroup ?? null,
            typicalDurationMin: dto.typicalDurationMin ?? null,
            requiresCleanRoom: dto.requiresCleanRoom ?? false,
            displayOrder: dto.displayOrder ?? 0,
            isActive: dto.isActive ?? true,
            createdBy: userId,
            updatedBy: userId,
        },
    });
}
async function updateProcessType(id, dto, schemaName, userId) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const existing = await db.processType.findUnique({ where: { id }, select: { id: true } });
    if (!existing)
        throw new ProcessTypeError('Process type not found', 404, 'NOT_FOUND');
    if (dto.processType) {
        const clash = await db.processType.findFirst({
            where: {
                processType: { equals: dto.processType, mode: 'insensitive' },
                NOT: { id },
            },
            select: { id: true },
        });
        if (clash) {
            throw new ProcessTypeError(`A process type named "${dto.processType}" already exists`, 409, 'DUPLICATE_NAME');
        }
    }
    return db.processType.update({
        select: SELECT,
        where: { id },
        data: {
            ...(dto.processType !== undefined && { processType: dto.processType }),
            ...(dto.processDetails !== undefined && { processDetails: dto.processDetails }),
            ...(dto.processGroup !== undefined && { processGroup: dto.processGroup }),
            ...(dto.typicalDurationMin !== undefined && { typicalDurationMin: dto.typicalDurationMin }),
            ...(dto.requiresCleanRoom !== undefined && { requiresCleanRoom: dto.requiresCleanRoom }),
            ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            updatedBy: userId,
            updatedAt: new Date(),
        },
    });
}
async function deleteProcessType(id, schemaName) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const existing = await db.processType.findUnique({ where: { id }, select: { id: true } });
    if (!existing)
        throw new ProcessTypeError('Process type not found', 404, 'NOT_FOUND');
    await db.processType.delete({ where: { id } });
}
/** Returns the distinct process groups for the tenant — used to populate the group filter. */
async function listProcessGroups(schemaName) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const rows = await db.processType.findMany({
        where: { processGroup: { not: null } },
        select: { processGroup: true },
        distinct: ['processGroup'],
        orderBy: { processGroup: 'asc' },
    });
    return rows.map((r) => r.processGroup);
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
async function streamProcessTypesCsv(schemaName, res) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const rows = await db.processType.findMany({
        select: SELECT,
        orderBy: [{ displayOrder: 'asc' }, { processType: 'asc' }],
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="process_types.csv"');
    res.write(csvRow(['process_id', 'process_type', 'process_details', 'process_group',
        'typical_duration_min', 'requires_clean_room', 'display_order', 'is_active']) + '\n');
    for (const r of rows) {
        res.write(csvRow([
            r.processId, r.processType, r.processDetails, r.processGroup,
            r.typicalDurationMin, r.requiresCleanRoom, r.displayOrder, r.isActive,
        ]) + '\n');
    }
    res.end();
}
async function importProcessTypes(rows, schemaName, userId) {
    const result = { created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
            await createProcessType({
                processType: row.processType,
                processDetails: row.processDetails,
                processGroup: row.processGroup,
                typicalDurationMin: row.typicalDurationMin,
                requiresCleanRoom: row.requiresCleanRoom,
                displayOrder: row.displayOrder,
            }, schemaName, userId);
            result.created++;
        }
        catch (err) {
            if (err instanceof ProcessTypeError && err.code === 'DUPLICATE_NAME')
                result.skipped++;
            else
                result.errors.push({ row: i + 1, message: err instanceof Error ? err.message : 'Unknown error' });
        }
    }
    return result;
}
