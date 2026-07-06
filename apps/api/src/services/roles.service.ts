import { getPrismaClient } from '../../lib/prisma';

export interface RoleListItem {
  id:          string;
  roleName:    string;
  roleGroup:   string | null;
  permissions: unknown;
  isActive:    boolean;
}

/**
 * Returns all active roles in the tenant schema, ordered by name.
 * Intended for dropdowns and role selection UIs.
 */
export async function listRoles(schemaName: string): Promise<RoleListItem[]> {
  const db = getPrismaClient(schemaName);

  return db.role.findMany({
    where:   { isActive: true },
    select: {
      id:          true,
      roleName:    true,
      roleGroup:   true,
      permissions: true,
      isActive:    true,
    },
    orderBy: { roleName: 'asc' },
  });
}
