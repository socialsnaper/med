-- ============================================================
-- Migration: extend login_audit.event_type to accept admin
--            action events (user_deactivated, user_reactivated)
--
-- Root cause: the column was originally constrained to only
-- the five login-flow event values.  Prisma already treats it
-- as plain VARCHAR(30) — this migration makes the DB match.
--
-- Safe to run multiple times (all steps are idempotent).
-- Run as a superuser or schema owner.
-- ============================================================

DO $$
DECLARE
  r   RECORD;
  c   RECORD;
BEGIN
  -- Iterate over every tenant schema registered in public.companies
  FOR r IN
    SELECT schema_name
    FROM   public.companies
    WHERE  schema_name LIKE 'tenant_%'
    ORDER  BY schema_name
  LOOP
    RAISE NOTICE 'Processing schema: %', r.schema_name;

    -- ── Step 1: Drop any CHECK constraint on event_type ────────────────────
    -- The constraint name is auto-generated and may vary, so we look it up
    -- via the catalog rather than hard-coding the name.
    FOR c IN
      SELECT con.conname
      FROM   pg_constraint  con
      JOIN   pg_class       rel ON rel.oid       = con.conrelid
      JOIN   pg_namespace   ns  ON ns.oid        = rel.relnamespace
      WHERE  ns.nspname  = r.schema_name
        AND  rel.relname = 'login_audit'
        AND  con.contype = 'c'            -- CHECK constraint
        AND  con.conkey  @> ARRAY[
               (SELECT attnum
                FROM   pg_attribute
                WHERE  attrelid = rel.oid
                  AND  attname  = 'event_type')::smallint
             ]
    LOOP
      RAISE NOTICE '  Dropping CHECK constraint: %', c.conname;
      EXECUTE format(
        'ALTER TABLE %I.login_audit DROP CONSTRAINT IF EXISTS %I',
        r.schema_name, c.conname
      );
    END LOOP;

    -- ── Step 2: Convert to plain VARCHAR(30) ───────────────────────────────
    -- Works whether the column is currently:
    --   a) VARCHAR(30) with a now-dropped CHECK constraint
    --   b) a PostgreSQL enum type ("LoginEventType") created by fix_enum_types.sql
    -- The USING clause casts any enum label to its text representation.
    EXECUTE format(
      'ALTER TABLE %I.login_audit
         ALTER COLUMN event_type TYPE VARCHAR(30)
         USING event_type::text',
      r.schema_name
    );
    RAISE NOTICE '  event_type converted to VARCHAR(30)';

    -- ── Step 3: Drop the enum type if it exists ────────────────────────────
    -- fix_enum_types.sql created "LoginEventType" as a schema-scoped enum.
    -- Dropping it is safe now that the column no longer references it.
    EXECUTE format(
      'DROP TYPE IF EXISTS %I."LoginEventType"',
      r.schema_name
    );
    RAISE NOTICE '  "LoginEventType" enum dropped (if existed)';

  END LOOP;

  RAISE NOTICE 'Migration complete.';
END $$;
