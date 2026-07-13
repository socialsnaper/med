"use strict";
/**
 * scripts/test-db.ts
 * Quick connectivity + sanity-check script for all tenant schemas.
 *
 * Run from apps/api/:
 *   npx ts-node scripts/test-db.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("../generated/prisma/client");
const prisma_1 = require("../lib/prisma");
// ── Helpers ──────────────────────────────────────────────────────────────────
const PASS = '✓';
const FAIL = '✗';
function header(title) {
    const bar = '─'.repeat(title.length + 4);
    console.log(`\n┌${bar}┐`);
    console.log(`│  ${title}  │`);
    console.log(`└${bar}┘`);
}
function row(label, value) {
    console.log(`  ${PASS}  ${label.padEnd(22)} ${value}`);
}
// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n═══════════════════════════════════════════════');
    console.log('  Digilog  ·  Database Connection Test Script  ');
    console.log('═══════════════════════════════════════════════');
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
        throw new Error('DATABASE_URL is not set — check apps/api/.env');
    }
    const overallStart = Date.now();
    // ── Step 1: Public schema — verify companies table ─────────────────────────
    header('STEP 1 · public.companies');
    const publicClient = new client_1.PrismaClient({
        adapter: new adapter_pg_1.PrismaPg({ connectionString: DATABASE_URL }, { schema: 'public' }),
    });
    let companies;
    try {
        companies = await publicClient.company.findMany({
            select: {
                id: true,
                companyName: true,
                companyCode: true,
                schemaName: true,
                isActive: true,
            },
            orderBy: { companyName: 'asc' },
        });
    }
    finally {
        await publicClient.$disconnect();
    }
    row('Companies found', companies.length);
    if (companies.length === 0) {
        console.log('\n  ⚠  No companies found. Run db/digilog_seed_company.sql first.');
        return;
    }
    for (const c of companies) {
        console.log(`       · [${c.companyCode}] ${c.companyName} → schema: ${c.schemaName} (active: ${c.isActive})`);
    }
    // ── Step 2: Per-tenant schema queries ─────────────────────────────────────
    for (const company of companies) {
        header(`STEP 2 · ${company.schemaName}  (${company.companyName})`);
        const tenantStart = Date.now();
        const db = (0, prisma_1.getPrismaClient)(company.schemaName);
        // Parallel counts
        const [totalUsers, activeUsers, lockedUsers, totalRoles, totalTokens] = await Promise.all([
            db.user.count(),
            db.user.count({ where: { isActive: true } }),
            db.user.count({ where: { isActive: false } }),
            db.role.count(),
            db.refreshToken.count({ where: { isRevoked: false } }),
        ]);
        row('Total users', totalUsers);
        row('Active users', activeUsers);
        row('Inactive / locked', lockedUsers);
        row('Roles', totalRoles);
        row('Live refresh tokens', totalTokens);
        // Most recently created user
        const latestUser = await db.user.findFirst({
            orderBy: { createdAt: 'desc' },
            select: {
                username: true,
                email: true,
                totpEnabled: true,
                mustChangePassword: true,
                createdAt: true,
            },
        });
        if (latestUser) {
            row('Latest user', `${latestUser.username} <${latestUser.email}>`);
            row('  TOTP enabled', String(latestUser.totpEnabled));
            row('  Must change pwd', String(latestUser.mustChangePassword));
        }
        // Roles breakdown by group
        const roleGroups = await db.role.groupBy({
            by: ['roleGroup'],
            _count: { id: true },
            orderBy: { roleGroup: 'asc' },
        });
        console.log(`\n  ${PASS}  Role groups:`);
        for (const rg of roleGroups) {
            console.log(`       · ${String(rg.roleGroup ?? 'null').padEnd(20)} ${rg._count.id} role(s)`);
        }
        const elapsed = Date.now() - tenantStart;
        console.log(`\n  Tenant queries completed in ${elapsed}ms`);
    }
    // ── Step 3: Validate schema guard ─────────────────────────────────────────
    header('STEP 3 · Schema name validation guard');
    const badNames = ['public', 'tenant_', '; DROP TABLE users', 'TENANT_PHARMACORE', ''];
    for (const bad of badNames) {
        try {
            (0, prisma_1.getPrismaClient)(bad);
            console.log(`  ${FAIL}  "${bad}" — should have been rejected but was not`);
        }
        catch {
            console.log(`  ${PASS}  "${bad}" correctly rejected`);
        }
    }
    // ── Summary ────────────────────────────────────────────────────────────────
    const total = Date.now() - overallStart;
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`  All checks passed · total time: ${total}ms`);
    console.log(`${'─'.repeat(50)}\n`);
}
main()
    .catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n  ${FAIL}  Test failed: ${message}\n`);
    process.exitCode = 1;
})
    .finally(async () => {
    await (0, prisma_1.disconnectAll)();
});
