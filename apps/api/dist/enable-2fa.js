"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("./generated/prisma/client");
async function reset2fa() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString)
        throw new Error('DATABASE_URL not set');
    const db = new client_1.PrismaClient({
        adapter: new adapter_pg_1.PrismaPg({ connectionString }, { schema: 'tenant_medsync' })
    });
    // Reset TOTP so user can go through the proper setup flow in the UI
    const user = await db.user.update({
        where: { username: 'sysadmin' },
        data: {
            totpEnabled: false,
            totpSecret: null,
        },
    });
    // Also clear any existing backup codes
    await db.totpBackupCode.deleteMany({ where: { userId: user.id } });
    console.log(`✓ Reset 2FA for ${user.username}`);
    console.log('\nNow do the following to set up 2FA properly with backup codes:');
    console.log('1. Login to the app: Company=medsync, Username=sysadmin, Password=Test@1234');
    console.log('2. After login, navigate to: http://localhost:3000/2fa/setup');
    console.log('3. Scan the QR code with Google Authenticator / Authy');
    console.log('4. Enter the 6-digit code to confirm');
    console.log('5. Your 8 backup codes will be displayed — save/download them!');
    await db.$disconnect();
}
reset2fa().catch(console.error);
