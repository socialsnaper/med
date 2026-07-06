-- Fix enum types: recreate with exact case that Prisma 7 expects
-- Prisma generates enum types named exactly as in schema.prisma (PascalCase)

-- Step 1: Revert columns back to plain text to allow dropping the types
ALTER TABLE tenant_pharmacore.login_attempts
  ALTER COLUMN identifier_type TYPE varchar USING identifier_type::text;

ALTER TABLE tenant_pharmacore.login_audit
  ALTER COLUMN event_type TYPE varchar USING event_type::text;

-- Step 2: Drop the lowercase-named types
DROP TYPE tenant_pharmacore.identifiertype;
DROP TYPE tenant_pharmacore.logineventtype;

-- Step 3: Recreate with PascalCase names (double-quoted to preserve case)
CREATE TYPE tenant_pharmacore."IdentifierType" AS ENUM ('username', 'ip');
CREATE TYPE tenant_pharmacore."LoginEventType" AS ENUM ('login_success', 'login_fail', 'logout', 'account_locked', 'token_refresh');

-- Step 4: Re-apply the enum types to the columns
ALTER TABLE tenant_pharmacore.login_attempts
  ALTER COLUMN identifier_type TYPE tenant_pharmacore."IdentifierType"
    USING identifier_type::tenant_pharmacore."IdentifierType";

ALTER TABLE tenant_pharmacore.login_audit
  ALTER COLUMN event_type TYPE tenant_pharmacore."LoginEventType"
    USING event_type::tenant_pharmacore."LoginEventType";

-- Verify
SELECT typname FROM pg_type
JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
WHERE nspname = 'tenant_pharmacore' AND typtype = 'e';
