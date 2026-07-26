-- ============================================================
-- DIGILOG — Room Master Table
-- PostgreSQL 15+
--
-- DEPENDS ON:
--   users      — created_by, updated_by FKs
--   room_types — room_type_id FK
--
-- NOTE: room_maintenance_logs.room_id references this table.
--       The current_maintenance_log_id column is added AFTER
--       room_maintenance_logs is created (see room_maintainance.sql)
-- ============================================================
SET search_path TO tenant_pharmacore;

CREATE TABLE IF NOT EXISTS rooms (

    -- ── IDENTIFIERS ──────────────────────────────────────────

    id                          UUID            PRIMARY KEY
                                                DEFAULT gen_random_uuid(),

    -- Human-readable Room code — RM-001, RM-002 etc.
    -- Application-controlled to allow customer numbering
    room_id                     VARCHAR(20)     NOT NULL UNIQUE,

    -- Full display name of the room
    -- e.g. "Granulation Room A", "QC Lab - West Wing"
    room_name                   VARCHAR(150)    NOT NULL UNIQUE,

    -- ── CLASSIFICATION ───────────────────────────────────────

    -- FK to room_types master
    -- NULL allowed — room may be typed later
    room_type_id                UUID            NULL
                                    REFERENCES tenant_pharmacore.room_types(id)
                                    ON DELETE SET NULL,

    -- Physical location — which floor the room is on
    -- e.g. "Ground Floor", "1st Floor"
    floor                       VARCHAR(50)     NULL,

    -- Building / block within the facility
    -- e.g. "Block A", "Manufacturing Wing"
    building                    VARCHAR(100)    NULL,

    -- Additional details about the room
    -- Dimensions, class designation, etc.
    room_details                TEXT            NULL,

    -- ── OPERATIONAL STATUS ───────────────────────────────────

    -- Current operational status of the room
    -- Controls availability for all downstream processes
    --
    -- active            = available for production, cleaning etc.
    -- under_maintenance = blocked (maintenance in progress) — AC2
    -- under_cleaning    = blocked (cleaning in progress)
    -- quarantined       = blocked (failed inspection)
    -- decommissioned    = permanently removed from service
    status                      VARCHAR(20)     NOT NULL DEFAULT 'active'
                                    CHECK (status IN (
                                        'active',
                                        'under_maintenance',
                                        'under_cleaning',
                                        'quarantined',
                                        'decommissioned'
                                    )),

    -- Free-text reason when status is not 'active'
    -- Provides context for why room is unavailable
    status_reason               TEXT            NULL,

    -- Quick pointer to the currently active maintenance log
    -- NULL = no active maintenance
    -- Updated on maintenance start; cleared on Stop (AC8)
    -- FK added AFTER room_maintenance_logs table is created
    -- (circular reference resolved by deferred FK)
    current_maintenance_log_id  UUID            NULL,

    -- ── SOFT DELETE ──────────────────────────────────────────

    -- FALSE = decommissioned / hidden from UI
    -- We never hard-delete rooms — historical process records
    -- reference them
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,

    -- ── AUDIT FIELDS ─────────────────────────────────────────

    created_by                  UUID            NULL
                                    REFERENCES tenant_pharmacore.users(id)
                                    ON DELETE SET NULL,

    updated_by                  UUID            NULL
                                    REFERENCES users(id)
                                    ON DELETE SET NULL,

    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()

);

-- ── INDEXES ──────────────────────────────────────────────────

-- Primary lookup — all active rooms
CREATE INDEX IF NOT EXISTS idx_rooms_active
    ON rooms (is_active)
    WHERE is_active = TRUE;

-- Status filter — block allocation when not active
CREATE INDEX IF NOT EXISTS idx_rooms_status
    ON rooms (status);

-- Rooms under maintenance — dashboard view
CREATE INDEX IF NOT EXISTS idx_rooms_under_maintenance
    ON rooms (status)
    WHERE status = 'under_maintenance';

-- Type-based filtering
CREATE INDEX IF NOT EXISTS idx_rooms_type
    ON rooms (room_type_id);

COMMENT ON TABLE rooms IS
    'Room master data. status column controls availability across all modules (maintenance, cleaning, batching, inspection). Never hard-deleted.';

COMMENT ON COLUMN rooms.status IS
    'Operational status. under_maintenance = blocked by maintenance (AC2). Restored to active when maintenance stops (AC8).';

COMMENT ON COLUMN rooms.current_maintenance_log_id IS
    'Pointer to currently active room_maintenance_log. NULL = no active maintenance. Updated atomically with status change.';


-- ── AUTO-UPDATE TRIGGER ───────────────────────────────────────

-- CREATE OR REPLACE TRIGGER trg_rooms_updated_at
--     BEFORE UPDATE ON rooms
--     FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── SEED DATA ─────────────────────────────────────────────────
-- Sample rooms for development and testing

INSERT INTO rooms (room_id, room_name, floor, building, status, is_active)
VALUES
    ('RM-001', 'Granulation Room A',      'Ground Floor', 'Block A', 'active', TRUE),
    ('RM-002', 'Granulation Room B',      'Ground Floor', 'Block A', 'active', TRUE),
    ('RM-003', 'Compression Room',        'Ground Floor', 'Block B', 'active', TRUE),
    ('RM-004', 'Coating Room',            '1st Floor',    'Block B', 'active', TRUE),
    ('RM-005', 'QC Laboratory',           '1st Floor',    'Block C', 'active', TRUE),
    ('RM-006', 'Dispensing Room',         'Ground Floor', 'Block A', 'active', TRUE),
    ('RM-007', 'Blending Room',           'Ground Floor', 'Block B', 'active', TRUE),
    ('RM-008', 'Packaging Room - Line 1', '2nd Floor',    'Block D', 'active', TRUE),
    ('RM-009', 'Packaging Room - Line 2', '2nd Floor',    'Block D', 'active', TRUE),
    ('RM-010', 'Microbiology Lab',        '1st Floor',    'Block C', 'active', TRUE)
ON CONFLICT (room_id) DO NOTHING;

-- ── ASSIGN ROOM TYPES ─────────────────────────────────────────
-- Links each seeded room to a matching room_type by name.
-- Safe to re-run — only updates rooms that still have NULL room_type_id.
-- Requires room_types rows to exist first (created via admin UI or seed).

UPDATE rooms SET room_type_id = (SELECT id FROM room_types WHERE room_type_name = 'Granulation Room'    LIMIT 1) WHERE room_id IN ('RM-001','RM-002') AND room_type_id IS NULL;
UPDATE rooms SET room_type_id = (SELECT id FROM room_types WHERE room_type_name = 'Compression Room'   LIMIT 1) WHERE room_id = 'RM-003' AND room_type_id IS NULL;
UPDATE rooms SET room_type_id = (SELECT id FROM room_types WHERE room_type_name = 'Coating Room'       LIMIT 1) WHERE room_id = 'RM-004' AND room_type_id IS NULL;
UPDATE rooms SET room_type_id = (SELECT id FROM room_types WHERE room_type_name = 'QC Laboratory'      LIMIT 1) WHERE room_id = 'RM-005' AND room_type_id IS NULL;
UPDATE rooms SET room_type_id = (SELECT id FROM room_types WHERE room_type_name = 'Dispensing Room'    LIMIT 1) WHERE room_id = 'RM-006' AND room_type_id IS NULL;
UPDATE rooms SET room_type_id = (SELECT id FROM room_types WHERE room_type_name = 'Blending Room'      LIMIT 1) WHERE room_id = 'RM-007' AND room_type_id IS NULL;
UPDATE rooms SET room_type_id = (SELECT id FROM room_types WHERE room_type_name = 'Packaging Room'     LIMIT 1) WHERE room_id IN ('RM-008','RM-009') AND room_type_id IS NULL;
UPDATE rooms SET room_type_id = (SELECT id FROM room_types WHERE room_type_name = 'Microbiology Lab'   LIMIT 1) WHERE room_id = 'RM-010' AND room_type_id IS NULL;
