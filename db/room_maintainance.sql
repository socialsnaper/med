-- ============================================================
-- DIGILOG — Room Maintenance Module
-- PostgreSQL 15+
--
-- DEPENDS ON:
--   users                — created_by, updated_by, marked_by FKs
--   rooms                — room_id FK
--   room_maintenance_types → room_maintenance_logs FK
--
-- RUN ORDER:
--   1. rooms.sql              (creates rooms table)
--   2. room_maintainance.sql  (this file — creates maintenance tables
--                              and adds deferred FK back to rooms)
-- ============================================================

-- ── TABLE 1 : room_maintenance_types ─────────────────────────────────────────
-- Admin-controlled master list.
-- Seeded with GMP-standard types: Preventive, Breakdown.

SET search_path TO tenant_pharmacore;

CREATE TABLE IF NOT EXISTS room_maintenance_types (

    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Human-readable code: MT-001, MT-002 …
    maintenance_type_code   VARCHAR(20)     NOT NULL UNIQUE,

    -- Display name — e.g. "Preventive", "Breakdown"
    maintenance_type_name   VARCHAR(150)    NOT NULL UNIQUE,

    -- Optional description / notes
    maintenance_type_details TEXT           NULL,

    -- Sort order for UI dropdowns
    display_order           INT             NOT NULL DEFAULT 0,

    -- Soft-delete
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,

    -- Audit
    created_by              UUID            NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by              UUID            NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS idx_room_maint_types_active
    ON room_maintenance_types (is_active)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_room_maint_types_order
    ON room_maintenance_types (display_order);

-- CREATE OR REPLACE TRIGGER trg_room_maint_types_updated_at
--     BEFORE UPDATE ON room_maintenance_types
--     FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed standard maintenance types
INSERT INTO room_maintenance_types
    (maintenance_type_code, maintenance_type_name, maintenance_type_details, display_order, is_active)
VALUES
    ('MT-001', 'Preventive', 'Scheduled preventive maintenance to avoid breakdowns.', 1, TRUE),
    ('MT-002', 'Breakdown',  'Corrective maintenance in response to an equipment/facility failure.', 2, TRUE)
ON CONFLICT (maintenance_type_code) DO NOTHING;

COMMENT ON TABLE room_maintenance_types IS
    'Master list of room maintenance types (Preventive, Breakdown, etc.). Admin-controlled.';


-- ── TABLE 2 : room_maintenance_logs ──────────────────────────────────────────
-- One row = one maintenance period for one room.
-- When status = active, the room is blocked from all downstream use.

CREATE TABLE IF NOT EXISTS room_maintenance_logs (

    id                          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Auto-incrementing display number (S.No on UI)
    slid                        SERIAL          NOT NULL UNIQUE,

    -- Room under maintenance
    room_id                     UUID            NOT NULL
                                    REFERENCES tenant_pharmacore.rooms(id)
                                    ON DELETE RESTRICT,

    -- Type of maintenance
    maintenance_type_id         UUID            NOT NULL
                                    REFERENCES room_maintenance_types(id)
                                    ON DELETE RESTRICT,

    -- ── TIMELINE ─────────────────────────────────────────────

    maintenance_start_datetime  TIMESTAMPTZ     NOT NULL,
    maintenance_end_datetime    TIMESTAMPTZ     NULL,

    -- Computed on Stop — end - start in minutes
    duration_minutes            INT             NULL,

    -- ── DETAILS ──────────────────────────────────────────────

    reason_for_maintenance      TEXT            NOT NULL,

    -- ── STATUS ───────────────────────────────────────────────
    -- scheduled   = future maintenance (start time > now)
    -- active      = maintenance currently in progress (room blocked)
    -- stopped     = maintenance completed (room restored)
    -- cancelled   = maintenance cancelled before start

    status                      VARCHAR(20)     NOT NULL DEFAULT 'active'
                                    CHECK (status IN (
                                        'scheduled',
                                        'active',
                                        'stopped',
                                        'cancelled'
                                    )),

    -- ── WHO DID WHAT ─────────────────────────────────────────

    -- User who requested/started the maintenance
    marked_by                   UUID            NOT NULL
                                    REFERENCES tenant_pharmacore.users(id)
                                    ON DELETE RESTRICT,

    stopped_by                  UUID            NULL
                                    REFERENCES tenant_pharmacore.users(id)
                                    ON DELETE SET NULL,

    stopped_at                  TIMESTAMPTZ     NULL,

    completion_remarks          TEXT            NULL,

    -- ── AUTHORIZATION ────────────────────────────────────────
    -- pending | approved | rejected | not_required

    authorized_by               UUID            NULL
                                    REFERENCES tenant_pharmacore.users(id)
                                    ON DELETE SET NULL,

    authorized_at               TIMESTAMPTZ     NULL,
    authorization_remarks       TEXT            NULL,

    authorization_status        VARCHAR(20)     NOT NULL DEFAULT 'pending'
                                    CHECK (authorization_status IN (
                                        'pending',
                                        'approved',
                                        'rejected',
                                        'not_required'
                                    )),

    -- ── AUDIT ────────────────────────────────────────────────

    created_by                  UUID            NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    updated_by                  UUID            NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS idx_rml_room_start
    ON room_maintenance_logs (room_id, maintenance_start_datetime DESC);

CREATE INDEX IF NOT EXISTS idx_rml_status
    ON room_maintenance_logs (status);

CREATE INDEX IF NOT EXISTS idx_rml_auth_status
    ON room_maintenance_logs (authorization_status);

CREATE INDEX IF NOT EXISTS idx_rml_active
    ON room_maintenance_logs (room_id, status)
    WHERE status = 'active';

-- CREATE OR REPLACE TRIGGER trg_room_maint_logs_updated_at
--     BEFORE UPDATE ON room_maintenance_logs
--     FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE room_maintenance_logs IS
    'One row per maintenance period. status=active blocks the room from all downstream modules.';


-- ── DEFERRED FK : rooms.current_maintenance_log_id → room_maintenance_logs ───
-- Resolves the circular reference between rooms ↔ room_maintenance_logs.
-- Added here (after room_maintenance_logs is created).

ALTER TABLE rooms
    ADD COLUMN IF NOT EXISTS current_maintenance_log_id UUID NULL
        REFERENCES room_maintenance_logs(id)
        ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rooms_current_maint_log
    ON rooms (current_maintenance_log_id)
    WHERE current_maintenance_log_id IS NOT NULL;

COMMENT ON COLUMN rooms.current_maintenance_log_id IS
    'FK to the currently active maintenance log. NULL = no active maintenance. Cleared on Stop.';


-- ── TABLE 3 : room_maintenance_audit ─────────────────────────────────────────
-- Append-only GMP audit trail. One row per action.

CREATE TABLE IF NOT EXISTS room_maintenance_audit (

    id                      BIGSERIAL       PRIMARY KEY,

    -- FK to the log record being audited (nullable — log may be deleted)
    maintenance_log_id      UUID            NULL
                                REFERENCES room_maintenance_logs(id)
                                ON DELETE SET NULL,

    -- Snapshot of room at time of action
    room_id_snapshot        UUID            NULL,
    room_name_snapshot      VARCHAR(150)    NULL,
    room_id_code_snapshot   VARCHAR(20)     NULL,

    -- What happened
    action                  VARCHAR(30)     NOT NULL,
                                -- CREATE | UPDATE | STOP | CANCEL | APPROVE | REJECT

    -- Full JSON snapshot of before/after state
    before_state            JSONB           NULL,
    after_state             JSONB           NULL,

    -- Which fields changed
    changed_fields          TEXT[]          NOT NULL DEFAULT '{}',

    -- Who did it
    performed_by            UUID            NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    performed_by_username   VARCHAR(100)    NULL,
    performed_by_role       VARCHAR(100)    NULL,

    -- Who authorized it (if applicable)
    authorized_by           UUID            NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    authorized_by_username  VARCHAR(100)    NULL,
    authorized_by_role      VARCHAR(100)    NULL,

    authorization_status    VARCHAR(20)     NULL,
    remarks                 TEXT            NULL,

    -- Network info (GMP traceability)
    ip_address              VARCHAR(45)     NULL,
    user_agent              TEXT            NULL,

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS idx_rma_log_created
    ON room_maintenance_audit (maintenance_log_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rma_performed_by
    ON room_maintenance_audit (performed_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rma_action
    ON room_maintenance_audit (action, created_at DESC);

COMMENT ON TABLE room_maintenance_audit IS
    'Append-only GMP audit trail. Every maintenance action is recorded here with before/after state.';
