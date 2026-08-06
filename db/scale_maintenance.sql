-- ============================================================
-- DIGILOG — Scale Maintenance Module
-- PostgreSQL 15+
--
-- DEPENDS ON:
--   users                 — created_by, updated_by, marked_by FKs
--   scales                — scale_id FK
--   scale_maintenance_types → scale_maintenance_logs FK
--
-- RUN ORDER:
--   1. scale.sql               (creates scales table)
--   2. scale_maintenance.sql   (this file)
-- ============================================================

SET search_path TO tenant_pharmacore;

-- ── TABLE 1 : scale_maintenance_types ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scale_maintenance_types (

    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    slid                    SERIAL          NOT NULL,

    maintenance_type_code   VARCHAR(20)     NOT NULL UNIQUE,
    maintenance_type_name   VARCHAR(150)    NOT NULL UNIQUE,
    maintenance_type_details TEXT           NULL,

    display_order           INT             NOT NULL DEFAULT 0,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,

    created_by              UUID            NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by              UUID            NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS idx_scale_maint_types_active
    ON scale_maintenance_types (is_active)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_scale_maint_types_order
    ON scale_maintenance_types (display_order);

-- Seed standard maintenance types
INSERT INTO scale_maintenance_types (maintenance_type_code, maintenance_type_name, display_order)
VALUES
    ('SMT-01', 'Preventive',    1),
    ('SMT-02', 'Calibration',   2),
    ('SMT-03', 'Breakdown',     3),
    ('SMT-04', 'Verification',  4)
ON CONFLICT (maintenance_type_code) DO NOTHING;

-- ── TABLE 2 : scale_maintenance_logs ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scale_maintenance_logs (

    id                          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    slid                        SERIAL          NOT NULL,

    -- FK to scales
    scale_id                    UUID            NOT NULL REFERENCES scales(id) ON DELETE RESTRICT,

    -- FK to scale_maintenance_types
    maintenance_type_id         UUID            NOT NULL REFERENCES scale_maintenance_types(id) ON DELETE RESTRICT,

    maintenance_start_datetime  TIMESTAMPTZ     NOT NULL,
    maintenance_end_datetime    TIMESTAMPTZ     NULL,
    duration_minutes            INT             NULL,

    reason_for_maintenance      TEXT            NOT NULL,

    -- scheduled | active | stopped | cancelled
    status                      VARCHAR(20)     NOT NULL DEFAULT 'scheduled',

    -- Who created the record (User Admin)
    marked_by                   UUID            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    -- Who stopped the maintenance (Maintenance Technician)
    stopped_by                  UUID            NULL REFERENCES users(id) ON DELETE SET NULL,
    stopped_at                  TIMESTAMPTZ     NULL,
    completion_remarks          TEXT            NULL,

    -- System Administrator approval
    authorized_by               UUID            NULL REFERENCES users(id) ON DELETE SET NULL,
    authorized_at               TIMESTAMPTZ     NULL,
    authorization_remarks       TEXT            NULL,

    -- pending | approved | rejected
    authorization_status        VARCHAR(20)     NOT NULL DEFAULT 'pending',

    created_by                  UUID            NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by                  UUID            NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS idx_scale_maint_logs_scale_id
    ON scale_maintenance_logs (scale_id);

CREATE INDEX IF NOT EXISTS idx_scale_maint_logs_status
    ON scale_maintenance_logs (status);

CREATE INDEX IF NOT EXISTS idx_scale_maint_logs_auth_status
    ON scale_maintenance_logs (authorization_status);

CREATE INDEX IF NOT EXISTS idx_scale_maint_logs_start_dt
    ON scale_maintenance_logs (maintenance_start_datetime DESC);

-- ── ALTER scales — add current_maintenance_log_id ────────────────────────────
-- Deferred FK allows creating the log and updating the scale in one transaction.

ALTER TABLE scales
    ADD COLUMN IF NOT EXISTS current_maintenance_log_id UUID NULL;

-- Add deferred FK after both tables exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_scales_current_maint_log'
          AND table_name = 'scales'
    ) THEN
        ALTER TABLE scales
            ADD CONSTRAINT fk_scales_current_maint_log
            FOREIGN KEY (current_maintenance_log_id)
            REFERENCES scale_maintenance_logs(id)
            DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;
