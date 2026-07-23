import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Tenant schema names must follow the pattern: tenant_<alphanumeric_or_underscore>
 * This guards against malformed schema names being injected into the connection URL.
 */
const TENANT_SCHEMA_RE = /^tenant_[a-z0-9_]+$/;

/** SSL config: disable cert verification for RDS self-signed certs in production. */
const pgOptions = process.env.NODE_ENV === 'production'
  ? { ssl: { rejectUnauthorized: false } }
  : undefined;

/** Module-level cache — one PrismaClient per schema, reused across requests. */
const clientCache = new Map<string, PrismaClient>();
let _publicClient: PrismaClient | null = null;

/**
 * Build a PrismaPg adapter factory scoped to `schemaName`.
 * PrismaPg forwards `schema` to PostgreSQL as `search_path`, so every query
 * from the returned client runs inside the correct tenant schema.
 */
function buildAdapter(schemaName: string): PrismaPg {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL environment variable is not set. ' +
      'Add it to apps/api/.env before starting the server.'
    );
  }
  return new PrismaPg({ connectionString, ...pgOptions }, { schema: schemaName });
}

/**
 * Returns a cached PrismaClient scoped to the public schema.
 * Use this for global tables such as public.companies.
 */
export function getPublicClient(): PrismaClient {
  if (_publicClient) return _publicClient;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set.');
  }
  _publicClient = new PrismaClient({
    adapter: new PrismaPg({ connectionString, ...pgOptions }, { schema: 'public' }),
  });
  return _publicClient;
}

/**
 * Returns a PrismaClient whose search_path is scoped to `schemaName`.
 *
 * Clients are cached by schema name — calling this multiple times with the
 * same schema is safe and will NOT open extra connection pools.
 *
 * @param schemaName - e.g. "tenant_pharmacore" or "tenant_medsync"
 * @throws If schemaName does not match the expected pattern.
 *
 * @example
 *   const db = getPrismaClient(company.schemaName);
 *   const user = await db.user.findUnique({ where: { username } });
 */
export function getPrismaClient(schemaName: string): PrismaClient {
  if (!TENANT_SCHEMA_RE.test(schemaName)) {
    throw new Error(
      `Invalid schema name: "${schemaName}". ` +
      'Schema names must match: tenant_<alphanumeric_or_underscore>'
    );
  }

  const cached = clientCache.get(schemaName);
  if (cached) return cached;

  const client = new PrismaClient({
    adapter: buildAdapter(schemaName),
  });

  clientCache.set(schemaName, client);
  return client;
}

/**
 * Gracefully disconnects all cached Prisma clients.
 * Call this during server shutdown (SIGTERM / SIGINT) to drain connection pools.
 *
 * @example
 *   process.on('SIGTERM', async () => {
 *     await disconnectAll();
 *     process.exit(0);
 *   });
 */
export async function disconnectAll(): Promise<void> {
  const clients = [...clientCache.values()];
  if (_publicClient) clients.push(_publicClient);
  await Promise.all(clients.map((c) => c.$disconnect()));
  clientCache.clear();
  _publicClient = null;
}
