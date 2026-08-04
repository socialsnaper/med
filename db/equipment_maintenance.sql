-- ============================================================
-- DIGILOG — Equipment Maintenance Module
-- PostgreSQL 15+
--
-- DEPENDS ON:
--   users                       — FK references
--   cleaning_equipment          — equipment_id FK
--   equipment_maintenance_types — equipment_maintenance_logs FK
--
-- RUN ORDER:
--   1. cleaning_equipment.sql  (cleaning_equipment table)
--   2. equipment_maintenance.sql  (this file)
-- ============================================================

SET search_path TO tenant_pharmacore;

-- ── Step 0: Add new columns to cleaning_equipment ─────────────────────────────

ALTER TABLE cleaning_equipment
  ADD COLUMN IF NOT EXISTS location                 VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS manufacturer             VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS status                   VARCHAR(20)  NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_reason            TEXT         NULL,
  ADD COLUMN IF NOT EXISTS current_maintenance_log_id UUID       NULL;

-- ── TABLE 1 : equipment_maintenance_types ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS equipment_maintenance_types (

    id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_type_code    VARCHAR(20)  NOT NULL UNIQUE,
    maintenance_type_name    VARCHAR(150) NOT NULL UNIQUE,
    maintenance_type_details TEXT         NULL,
    display_order            INT          NOT NULL DEFAULT 0,
    is_active                BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by               UUID         NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    updated_by               UUID         NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS idx_equ_maint_types_active
    ON equipment_maintenance_types (is_active)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_equ_maint_types_order
    ON equipment_maintenance_types (display_order);

INSERT INTO equipment_maintenance_types
    (maintenance_type_code, maintenance_type_name, maintenance_type_details, display_order, is_active)
VALUES
    ('EMT-001', 'Preventive', 'Scheduled preventive maintenance to avoid breakdowns.', 1, TRUE),
    ('EMT-002', 'Breakdown',  'Corrective maintenance in response to an equipment failure.', 2, TRUE)
ON CONFLICT (maintenance_type_code) DO NOTHING;

COMMENT ON TABLE equipment_maintenance_types IS
    'Master list of equipment maintenance types (Preventive, Breakdown). Admin-controlled.';


-- ── TABLE 2 : equipment_maintenance_logs ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS equipment_maintenance_logs (

    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    slid                        SERIAL      NOT NULL,

    equipment_id                UUID        NOT NULL REFERENCES tenant_pharmacore.cleaning_equipment(id) ON DELETE RESTRICT,
    maintenance_type_id         UUID        NOT NULL REFERENCES tenant_pharmacore.equipment_maintenance_types(id) ON DELETE RESTRICT,

    maintenance_start_datetime  TIMESTAMPTZ NOT NULL,
    maintenance_end_datetime    TIMESTAMPTZ NULL,
    duration_minutes            INT         NULL,

    reason_for_maintenance      TEXT        NOT NULL,

    -- scheduled | active | stopped | cancelled
    status                      VARCHAR(20) NOT NULL DEFAULT 'scheduled',

    -- Who created the request
    marked_by                   UUID        NOT NULL REFERENCES tenant_pharmacore.users(id) ON DELETE RESTRICT,

    -- Who stopped work
    stopped_by                  UUID        NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    stopped_at                  TIMESTAMPTZ NULL,
    completion_remarks          TEXT        NULL,

    -- System Admin authorisation
    authorized_by               UUID        NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    authorized_at               TIMESTAMPTZ NULL,
    authorization_remarks       TEXT        NULL,
    -- pending | approved | rejected
    authorization_status        VARCHAR(20) NOT NULL DEFAULT 'pending',

    created_by                  UUID        NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    updated_by                  UUID        NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS idx_equ_maint_logs_equipment
    ON equipment_maintenance_logs (equipment_id);

CREATE INDEX IF NOT EXISTS idx_equ_maint_logs_status
    ON equipment_maintenance_logs (status);

CREATE INDEX IF NOT EXISTS idx_equ_maint_logs_auth_status
    ON equipment_maintenance_logs (authorization_status);

COMMENT ON TABLE equipment_maintenance_logs IS
    'One row = one maintenance period for one equipment item.';


-- ── TABLE 3 : equipment_maintenance_audit ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS equipment_maintenance_audit (

    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_log_id       UUID        NULL REFERENCES tenant_pharmacore.equipment_maintenance_logs(id) ON DELETE SET NULL,

    equipment_id_snapshot    UUID        NULL,
    equipment_name_snapshot  VARCHAR(150) NULL,
    equipment_code_snapshot  VARCHAR(20)  NULL,

    action                   VARCHAR(20) NOT NULL,     -- CREATE | UPDATE | START | STOP | APPROVE | REJECT

    before_state             JSONB       NULL,
    after_state              JSONB       NULL,
    changed_fields           TEXT[]      NULL,

    performed_by             UUID        NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    performed_by_username    VARCHAR(100) NULL,
    performed_by_role        VARCHAR(100) NULL,
    authorization_status     VARCHAR(20)  NULL,
    ip_address               TEXT         NULL,

    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS idx_equ_maint_audit_log
    ON equipment_maintenance_audit (maintenance_log_id);

CREATE INDEX IF NOT EXISTS idx_equ_maint_audit_created
    ON equipment_maintenance_audit (created_at DESC);

COMMENT ON TABLE equipment_maintenance_audit IS
    'Append-only GMP audit trail for equipment maintenance actions.';


-- ── Step 3: Deferred FK from cleaning_equipment back to equipment_maintenance_logs ──

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_equip_current_maint'
  ) THEN
    ALTER TABLE cleaning_equipment
      ADD CONSTRAINT fk_equip_current_maint
      FOREIGN KEY (current_maintenance_log_id)
      REFERENCES equipment_maintenance_logs(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;
