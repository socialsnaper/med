// Fix corrupted password hashes — run with node directly (no ts-node needed)
// Usage: node fix-passwords.js

const bcrypt = require('../apps/api/node_modules/bcrypt');
const { Client } = require('../apps/api/node_modules/pg');

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'digilog_db',
    user: 'postgres',
    password: 'admin',
  });

  await client.connect();

  const hash = await bcrypt.hash('Test@1234', 12);
  console.log('New hash:', hash);

  // Verify the hash works
  const check = await bcrypt.compare('Test@1234', hash);
  console.log('Verification check:', check);

  // Update all tenant schemas
  const schemas = ['tenant_pharmacore'];
  for (const schema of schemas) {
    const res = await client.query(
      `UPDATE "${schema}".users SET password_hash = $1`,
      [hash]
    );
    console.log(`Updated ${res.rowCount} users in ${schema}`);
  }

  // Verify stored hash
  const rows = await client.query(
    `SELECT username, password_hash FROM tenant_pharmacore.users LIMIT 2`
  );
  for (const row of rows.rows) {
    const match = await bcrypt.compare('Test@1234', row.password_hash);
    console.log(`${row.username}: hash matches Test@1234 = ${match}`);
  }

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
