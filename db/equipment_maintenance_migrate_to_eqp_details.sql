-- ============================================================
-- DIGILOG — Equipment Maintenance: Migrate FK to equipment_details
-- PostgreSQL 15+
--
-- WHAT THIS DOES:
--   1. Adds status-tracking columns to equipment_details
--   2. Drops the old FK from equipment_maintenance_logs → cleaning_equipment
--   3. Drops the deferred FK from cleaning_equipment → equipment_maintenance_logs
--   4. Truncates existing maintenance log data (dev only — no production data yet)
--   5. Adds the new FK: equipment_maintenance_logs → equipment_details
--   6. Adds a deferred FK: equipment_details.current_maintenance_log_id → equipment_maintenance_logs
--
-- RUN ORDER:
--   1. equipment_details.sql  (equipment_details table must exist)
--   2. equipment_maintenance.sql  (equipment_maintenance_logs table must exist)
--   3. equipment_maintenance_migrate_to_eqp_details.sql  (this file)
--
-- ⚠ WARNING: TRUNCATES equipment_maintenance_logs and equipment_maintenance_audit.
--   Run only on development databases or after confirming no production data exists.
-- ============================================================

SET search_path TO tenant_pharmacore;

-- ── Step 1: Add maintenance-tracking columns to equipment_details ─────────────

ALTER TABLE equipment_details
  ADD COLUMN IF NOT EXISTS status                     VARCHAR(20)  NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_reason              TEXT         NULL,
  ADD COLUMN IF NOT EXISTS current_maintenance_log_id UUID         UNIQUE NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_details_status
  ON equipment_details (status);

COMMENT ON COLUMN equipment_details.status IS 'active | under_maintenance';
COMMENT ON COLUMN equipment_details.current_maintenance_log_id IS 'FK to active equipment_maintenance_logs entry; NULL = no active maintenance.';

-- ── Step 2: Safely clear existing maintenance data (dev only) ──────────────
-- ⚠ IMPORTANT: Do NOT use TRUNCATE ... CASCADE here — it would cascade to
--   equipment_details via the current_maintenance_log_id FK!

-- 2a. Null-out back-reference in equipment_details so truncate won't cascade
UPDATE equipment_details SET current_maintenance_log_id = NULL WHERE current_maintenance_log_id IS NOT NULL;
-- 2b. Null-out back-reference in cleaning_equipment (if it has one)
UPDATE cleaning_equipment SET current_maintenance_log_id = NULL WHERE current_maintenance_log_id IS NOT NULL;

-- 2c. Now truncate maintenance tables safely (no cascade needed)
DELETE FROM equipment_maintenance_audit;
DELETE FROM equipment_maintenance_logs;

-- ── Step 3: Drop old FK from equipment_maintenance_logs → cleaning_equipment ──

ALTER TABLE equipment_maintenance_logs
  DROP CONSTRAINT IF EXISTS equipment_maintenance_logs_equipment_id_fkey;

-- ── Step 4: Drop deferred FK from cleaning_equipment → equipment_maintenance_logs ──

ALTER TABLE cleaning_equipment
  DROP CONSTRAINT IF EXISTS fk_equip_current_maint;

-- ── Step 5: Add new FK from equipment_maintenance_logs → equipment_details ────

ALTER TABLE equipment_maintenance_logs
  ADD CONSTRAINT equipment_maintenance_logs_equipment_id_fkey
  FOREIGN KEY (equipment_id)
  REFERENCES equipment_details(id)
  ON DELETE RESTRICT;

-- ── Step 6: Add deferred FK from equipment_details → equipment_maintenance_logs ──

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_eqp_detail_current_maint'
  ) THEN
    ALTER TABLE equipment_details
      ADD CONSTRAINT fk_eqp_detail_current_maint
      FOREIGN KEY (current_maintenance_log_id)
      REFERENCES equipment_maintenance_logs(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;
