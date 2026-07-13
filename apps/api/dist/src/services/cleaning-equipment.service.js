"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleaningEquipmentError = void 0;
exports.listCleaningEquipment = listCleaningEquipment;
exports.getCleaningEquipment = getCleaningEquipment;
exports.createCleaningEquipment = createCleaningEquipment;
exports.updateCleaningEquipment = updateCleaningEquipment;
exports.deleteCleaningEquipment = deleteCleaningEquipment;
exports.streamCleaningEquipmentCsv = streamCleaningEquipmentCsv;
exports.importCleaningEquipment = importCleaningEquipment;
const prisma_1 = require("../../lib/prisma");
// ── Custom error ───────────────────────────────────────────────────────────────
class CleaningEquipmentError extends Error {
    statusCode;
    code;
    constructor(message, statusCode = 400, code = 'CLEANING_EQUIPMENT_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'CleaningEquipmentError';
    }
}
exports.CleaningEquipmentError = CleaningEquipmentError;
// ── ID generator ───────────────────────────────────────────────────────────────
async function nextEquipmentCode(schemaName) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const rows = await db.cleaningEquipment.findMany({
        select: { equipmentCode: true },
        orderBy: { equipmentCode: 'desc' },
    });
    let max = 0;
    for (const row of rows) {
        const m = row.equipmentCode.match(/^CE-(\d+)$/);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n > max)
                max = n;
        }
    }
    return `CE-${String(max + 1).padStart(3, '0')}`;
}
// ── Select projection ──────────────────────────────────────────────────────────
const SELECT = {
    id: true, equipmentCode: true, equipmentName: true,
    equipmentDetails: true, cleaningType: true, material: true,
    requiresReplacement: true, replacementIntervalDays: true,
    displayOrder: true, isActive: true, createdAt: true, updatedAt: true,
};
// ── CSV helpers ────────────────────────────────────────────────────────────────
function csvCell(v) {
    if (v === null || v === undefined)
        return '""';
    return `"${String(v).replace(/"/g, '""')}"`;
}
function csvRow(cells) {
    return cells.map(csvCell).join(',');
}
// ── Queries ────────────────────────────────────────────────────────────────────
async function listCleaningEquipment(schemaName, search, cleaningType) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    return db.cleaningEquipment.findMany({
        select: SELECT,
        where: {
            ...(cleaningType ? { cleaningType } : {}),
            ...(search
                ? {
                    OR: [
                        { equipmentCode: { contains: search, mode: 'insensitive' } },
                        { equipmentName: { contains: search, mode: 'insensitive' } },
                        { material: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}),
        },
        orderBy: [{ displayOrder: 'asc' }, { equipmentName: 'asc' }],
    });
}
async function getCleaningEquipment(id, schemaName) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const row = await db.cleaningEquipment.findUnique({ select: SELECT, where: { id } });
    if (!row)
        throw new CleaningEquipmentError('Cleaning equipment not found', 404, 'NOT_FOUND');
    return row;
}
async function createCleaningEquipment(dto, schemaName, userId) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const clash = await db.cleaningEquipment.findFirst({
        where: { equipmentName: { equals: dto.equipmentName, mode: 'insensitive' } },
        select: { id: true },
    });
    if (clash)
        throw new CleaningEquipmentError(`"${dto.equipmentName}" already exists`, 409, 'DUPLICATE_NAME');
    const equipmentCode = await nextEquipmentCode(schemaName);
    return db.cleaningEquipment.create({
        select: SELECT,
        data: {
            equipmentCode,
            equipmentName: dto.equipmentName,
            equipmentDetails: dto.equipmentDetails ?? null,
            cleaningType: dto.cleaningType ?? 'general',
            material: dto.material ?? null,
            requiresReplacement: dto.requiresReplacement ?? false,
            replacementIntervalDays: dto.replacementIntervalDays ?? null,
            displayOrder: dto.displayOrder ?? 0,
            isActive: dto.isActive ?? true,
            createdBy: userId,
            updatedBy: userId,
        },
    });
}
async function updateCleaningEquipment(id, dto, schemaName, userId) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const existing = await db.cleaningEquipment.findUnique({ where: { id }, select: { id: true } });
    if (!existing)
        throw new CleaningEquipmentError('Cleaning equipment not found', 404, 'NOT_FOUND');
    if (dto.equipmentName) {
        const clash = await db.cleaningEquipment.findFirst({
            where: { equipmentName: { equals: dto.equipmentName, mode: 'insensitive' }, NOT: { id } },
            select: { id: true },
        });
        if (clash)
            throw new CleaningEquipmentError(`"${dto.equipmentName}" already exists`, 409, 'DUPLICATE_NAME');
    }
    return db.cleaningEquipment.update({
        select: SELECT,
        where: { id },
        data: {
            ...(dto.equipmentName !== undefined && { equipmentName: dto.equipmentName }),
            ...(dto.equipmentDetails !== undefined && { equipmentDetails: dto.equipmentDetails }),
            ...(dto.cleaningType !== undefined && { cleaningType: dto.cleaningType }),
            ...(dto.material !== undefined && { material: dto.material }),
            ...(dto.requiresReplacement !== undefined && { requiresReplacement: dto.requiresReplacement }),
            ...(dto.replacementIntervalDays !== undefined && { replacementIntervalDays: dto.replacementIntervalDays }),
            ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            updatedBy: userId,
            updatedAt: new Date(),
        },
    });
}
async function deleteCleaningEquipment(id, schemaName) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const existing = await db.cleaningEquipment.findUnique({ where: { id }, select: { id: true } });
    if (!existing)
        throw new CleaningEquipmentError('Cleaning equipment not found', 404, 'NOT_FOUND');
    await db.cleaningEquipment.delete({ where: { id } });
}
// ── CSV Export ─────────────────────────────────────────────────────────────────
const CSV_HEADER = csvRow([
    'equipment_code', 'equipment_name', 'equipment_details',
    'cleaning_type', 'material', 'requires_replacement',
    'replacement_interval_days', 'display_order', 'is_active',
]);
async function streamCleaningEquipmentCsv(schemaName, res) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    const rows = await db.cleaningEquipment.findMany({
        select: SELECT,
        orderBy: [{ displayOrder: 'asc' }, { equipmentName: 'asc' }],
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="cleaning_equipment.csv"');
    res.write(CSV_HEADER + '\n');
    for (const r of rows) {
        res.write(csvRow([
            r.equipmentCode, r.equipmentName, r.equipmentDetails,
            r.cleaningType, r.material, r.requiresReplacement,
            r.replacementIntervalDays, r.displayOrder, r.isActive,
        ]) + '\n');
    }
    res.end();
}
async function importCleaningEquipment(rows, schemaName, userId) {
    const result = { created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
            await createCleaningEquipment({
                equipmentName: row.equipmentName,
                equipmentDetails: row.equipmentDetails,
                cleaningType: row.cleaningType,
                material: row.material,
                requiresReplacement: row.requiresReplacement,
                replacementIntervalDays: row.replacementIntervalDays,
                displayOrder: row.displayOrder,
            }, schemaName, userId);
            result.created++;
        }
        catch (err) {
            if (err instanceof CleaningEquipmentError && err.code === 'DUPLICATE_NAME') {
                result.skipped++;
            }
            else {
                result.errors.push({ row: i + 1, message: err instanceof Error ? err.message : 'Unknown error' });
            }
        }
    }
    return result;
}
