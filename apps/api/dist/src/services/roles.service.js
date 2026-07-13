"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRoles = listRoles;
const prisma_1 = require("../../lib/prisma");
/**
 * Returns all active roles in the tenant schema, ordered by name.
 * Intended for dropdowns and role selection UIs.
 */
async function listRoles(schemaName) {
    const db = (0, prisma_1.getPrismaClient)(schemaName);
    return db.role.findMany({
        where: { isActive: true },
        select: {
            id: true,
            roleName: true,
            roleGroup: true,
            permissions: true,
            isActive: true,
        },
        orderBy: { roleName: 'asc' },
    });
}
