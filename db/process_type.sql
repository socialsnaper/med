-- ============================================================
-- DIGILOG — Process Types Module Database Schema
-- PostgreSQL 15+
--
-- WHAT THIS FILE CONTAINS:
--   TABLE 1 : process_types — manufacturing process classifications
--
-- WHERE IT LIVES:
--   Tenant schema — e.g. tenant_pharmacore, tenant_pharmacore
--   Run after digilog_login.sql and digilog_rooms.sql
--
-- WHAT IS A PROCESS TYPE?
--   The manufacturing operation performed in a batch step.
--   e.g. PR-001 Grinding, PR-002 Blending, PR-003 Compression
--   Admin configures these once as master data.
--   Later used in:
--     → batch_process_steps  (which process ran at each step)
--     → equipment            (which processes a machine supports)
--     → rooms                (which processes happen in a room)
--
-- DEPENDS ON:
--   users table — for created_by, updated_by audit fields
-- ============================================================


-- ============================================================
-- TABLE 1: process_types
-- Pure lookup / master data table
-- One row = one type of manufacturing operation
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_pharmacore.process_types (

    -- ── IDENTIFIERS ──────────────────────────────────────────

    -- Internal UUID — used as FK in batch_process_steps
    -- and equipment.supported_process_ids later
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Human-readable code shown in the UI and reports
    -- Format: PR-001, PR-002, PR-003 etc.
    -- Application generates this — not DB auto-increment
    -- Unique per tenant schema
    process_id          VARCHAR(20)     NOT NULL UNIQUE,

    -- Full name of the process
    -- e.g. "Grinding", "Blending", "Compression", "Granulation"
    process_type        VARCHAR(150)    NOT NULL UNIQUE,

    -- Detailed description of what this process involves
    -- Shown in the Process Type Details column on the list screen
    -- e.g. "Process of reducing particle size by abrasive contact and shear"
    process_details     TEXT            NULL,

    -- ── CLASSIFICATION ───────────────────────────────────────

    -- Groups related processes together
    -- Used for filtering in batch management screens
    -- e.g. "Primary Manufacturing" | "Secondary Manufacturing"
    --       "Packaging" | "Quality Control"
    -- NULL = ungrouped
    process_group       VARCHAR(100)    NULL,

    -- Typical duration of this process in minutes
    -- Reference value — actual duration recorded in batch steps
    -- Helps operators estimate batch completion time
    typical_duration_min INT            NULL,

    -- Whether this process requires a dedicated clean room
    -- TRUE = room must be cleaned before this process can start
    -- Used later in batch step validation
    requires_clean_room BOOLEAN         NOT NULL DEFAULT FALSE,

    -- ── ORDERING AND STATUS ───────────────────────────────────

    -- Controls order in dropdowns and batch step sequencing
    -- Lower number = appears first
    -- Admin can reorder without renaming IDs
    display_order       INT             NOT NULL DEFAULT 0,

    -- FALSE = soft-deleted, hidden from UI
    -- Cannot hard-delete if referenced by batch_process_steps
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,

    -- ── AUDIT FIELDS ─────────────────────────────────────────

    created_by          UUID            NULL REFERENCES tenant_pharmacore.users(id)
                                            ON DELETE SET NULL,

    updated_by          UUID            NULL REFERENCES tenant_pharmacore.users(id)
                                            ON DELETE SET NULL,

    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()

);
    
-- ── INDEXES ──────────────────────────────────────────────────

-- Lookup by process_id — used in imports and batch step creation
CREATE INDEX IF NOT EXISTS idx_process_types_process_id
    ON tenant_pharmacore.process_types (process_id);

-- Active processes only — used in all batch management dropdowns
CREATE INDEX IF NOT EXISTS idx_process_types_active
    ON tenant_pharmacore.process_types (is_active)
    WHERE is_active = TRUE;

-- Filter by group — used in batch management filter panel
CREATE INDEX IF NOT EXISTS idx_process_types_group
    ON tenant_pharmacore.process_types (process_group)
    WHERE process_group IS NOT NULL;

-- Ordered display — dropdown and list screen ordering
CREATE INDEX IF NOT EXISTS idx_process_types_order
    ON tenant_pharmacore.process_types (display_order, process_type);

-- Full-text search — search bar on the list screen
CREATE INDEX IF NOT EXISTS idx_process_types_search
    ON tenant_pharmacore.process_types USING gin (
        to_tsvector('english', process_type || ' ' || COALESCE(process_details, ''))
    );

-- ── COMMENTS ─────────────────────────────────────────────────

COMMENT ON TABLE tenant_pharmacore.process_types IS
    'Master list of manufacturing process types. Used in batch steps and equipment configuration.';

COMMENT ON COLUMN tenant_pharmacore.process_types.process_id IS
    'Human-readable code e.g. PR-001. Generated by application, enforced unique by DB.';

COMMENT ON COLUMN tenant_pharmacore.process_types.process_group IS
    'Optional grouping e.g. Primary Manufacturing, Packaging. Used for filtering.';

COMMENT ON COLUMN tenant_pharmacore.process_types.typical_duration_min IS
    'Reference duration in minutes. Not enforced — actual duration recorded in batch steps.';

COMMENT ON COLUMN tenant_pharmacore.process_types.requires_clean_room IS
    'If TRUE, batch step validation will check room cleaning status before allowing start.';

COMMENT ON COLUMN tenant_pharmacore.process_types.display_order IS
    'Controls ordering in dropdowns. Lower number appears first.';


-- ── AUTO-UPDATE TRIGGER ───────────────────────────────────────

CREATE OR REPLACE TRIGGER trg_process_types_updated_at
    BEFORE UPDATE ON tenant_pharmacore.process_types
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SEED DATA
-- The 7 process types visible in your screen (image 9)
-- Plus Coating and Drying which appear in equipment details
-- screen (image 3: "Drying, Granulation", "Coating")
-- ============================================================

INSERT INTO tenant_pharmacore.process_types
    (process_id, process_type, process_details,
     process_group, typical_duration_min,
     requires_clean_room, display_order, is_active)
VALUES

    -- ── PRIMARY MANUFACTURING ─────────────────────────────────

    (
        'PR-001',
        'Grinding',
        'Process of reducing particle size by abrasive contact and shear force to achieve desired powder fineness.',
        'Primary Manufacturing', 60,
        TRUE, 1, TRUE
    ),
    (
        'PR-002',
        'Blending',
        'Process of mixing two or more ingredients together to achieve a uniform and homogeneous composition.',
        'Primary Manufacturing', 45,
        TRUE, 2, TRUE
    ),
    (
        'PR-003',
        'Compression',
        'Process of compressing powder or granules into tablets using a tablet compression machine.',
        'Primary Manufacturing', 120,
        TRUE, 3, TRUE
    ),
    (
        'PR-004',
        'Granulation',
        'Process of converting fine powder particles into granules to improve flow and compressibility.',
        'Primary Manufacturing', 90,
        TRUE, 4, TRUE
    ),
    (
        'PR-005',
        'Drying',
        'Process of removing moisture from granules or wet mass using a fluid bed dryer or oven.',
        'Primary Manufacturing', 180,
        TRUE, 5, TRUE
    ),
    (
        'PR-006',
        'Coating',
        'Process of applying a thin film or sugar coat onto tablet surfaces for taste masking or controlled release.',
        'Primary Manufacturing', 240,
        TRUE, 6, TRUE
    ),
    (
        'PR-007',
        'Sieving',
        'Process of separating particles by size using a vibrating sieve to ensure uniform granule size.',
        'Primary Manufacturing', 30,
        TRUE, 7, TRUE
    ),
    (
        'PR-008',
        'Mixing',
        'Process of combining ingredients using a mixer to achieve uniform distribution of active and excipients.',
        'Primary Manufacturing', 60,
        TRUE, 8, TRUE
    ),

    -- ── PACKAGING ────────────────────────────────────────────

    (
        'PR-009',
        'Packaging',
        'Process of packing finished pharmaceutical products into suitable primary and secondary packaging materials.',
        'Packaging', 150,
        FALSE, 9, TRUE
    ),
    (
        'PR-010',
        'Labeling',
        'Process of applying product labels with batch number, expiry date, and regulatory information.',
        'Packaging', 60,
        FALSE, 10, TRUE
    ),

    -- ── QUALITY CONTROL ───────────────────────────────────────

    (
        'PR-011',
        'Sampling',
        'Process of collecting representative samples from raw materials or in-process batches for quality testing.',
        'Quality Control', 30,
        FALSE, 11, TRUE
    ),
    (
        'PR-012',
        'Testing',
        'Process of performing analytical tests on samples to verify compliance with product specifications.',
        'Quality Control', 120,
        FALSE, 12, TRUE
    )

ON CONFLICT (process_id) DO NOTHING;


-- ============================================================
-- VERIFICATION QUERIES
-- Run after seeding to confirm data is correct
-- ============================================================

-- Full list matching the UI screen layout
SELECT
    ROW_NUMBER() OVER (ORDER BY display_order)  AS "S.No",
    process_id                                   AS "Process ID",
    process_type                                 AS "Process Type",
    process_details                              AS "Process Type Details",
    process_group                                AS "Group",
    typical_duration_min                         AS "Typical Duration (min)",
    requires_clean_room                          AS "Needs Clean Room",
    is_active                                    AS "Active"
FROM tenant_pharmacore.process_types
ORDER BY display_order;

-- Count by group
SELECT
    COALESCE(process_group, 'Ungrouped')    AS "Group",
    COUNT(*)                                AS "Count",
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END) AS "Active"
FROM tenant_pharmacore.process_types
GROUP BY process_group
ORDER BY MIN(display_order);

-- ============================================================
-- END OF FILE
-- ============================================================