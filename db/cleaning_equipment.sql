-- ============================================================
-- DIGILOG — Cleaning Equipment (Tools) Module
-- PostgreSQL 15+
--
-- WHAT THIS FILE CONTAINS:
--   TABLE 1 : cleaning_equipment
--             Master list of cleaning tools available
--             e.g. Mop, Scrub brush, Spray pump, Dust pan
--
--   TABLE 2 : cleaning_sop_step_tools
--             Junction table — links tools to SOP cleaning steps
--             Replaces the comma-separated "Equipment Used" column
--             seen in Room Cleaning SOP and Equipment Cleaning SOP screens
--
-- WHERE IT LIVES:
--   Tenant schema — e.g. tenant_pharmacore
--
-- WHY TWO TABLES INSTEAD OF A TEXT COLUMN?
--   Your current screens store tools as a comma string:
--   "Hand brush, Dust pan" — this causes problems:
--     → Cannot search "which SOPs use a Mop"
--     → Cannot report tool usage across the factory
--     → Typos create duplicates ("mop" vs "Mop" vs "MOP")
--     → Cannot track tool calibration or replacement
--   Two tables give you a clean, searchable, reportable structure.
--
-- DEPENDS ON:
--   users table — for audit fields
--   room_cleaning_sop and equipment_cleaning_sop tables
--   (those are created in the SOP module — linked later)
-- ============================================================


-- ============================================================
-- TABLE 1: cleaning_equipment
-- The master list of physical cleaning tools in the facility
-- Admin manages this list — operators select from it
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_pharmacore.cleaning_equipment (

    -- ── IDENTIFIERS ──────────────────────────────────────────

    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Human-readable code shown in admin screens
    -- Format: CE-001, CE-002 etc.
    -- Application generates — DB enforces uniqueness
    equipment_code          VARCHAR(20)     NOT NULL UNIQUE,

    -- Tool name shown in dropdowns and SOP step forms
    -- e.g. "Mop", "Scrub brush", "Spray pump", "Dust pan"
    equipment_name          VARCHAR(150)    NOT NULL UNIQUE,

    -- Longer description of the tool and its proper use
    -- e.g. "Used for applying cleaning solution to floor surfaces"
    equipment_details       TEXT            NULL,

    -- ── CLASSIFICATION ───────────────────────────────────────

    -- What type of cleaning this tool is used for
    -- Drives filtering in SOP step forms so operators
    -- only see relevant tools for the cleaning type selected
    -- Values:
    --   dry        → Dry cleaning tools (brushes, dust pan, vacuum)
    --   wet        → Wet cleaning tools (mop, bucket, cloth)
    --   sanitizing → Sanitizing tools (spray pump, sprayer)
    --   general    → Used across all cleaning types
    cleaning_type           VARCHAR(20)     NOT NULL DEFAULT 'general'
                                CHECK (cleaning_type IN (
                                    'dry',
                                    'wet',
                                    'sanitizing',
                                    'general'
                                )),

    -- Material the tool is made of
    -- Important for GMP — some materials are not permitted
    -- in certain cleanroom classifications
    -- e.g. "Stainless Steel", "Nylon", "Microfiber", "Rubber"
    material                VARCHAR(100)    NULL,

    -- Whether this tool requires periodic replacement or
    -- calibration tracking
    -- TRUE = system will alert when replacement is due
    requires_replacement    BOOLEAN         NOT NULL DEFAULT FALSE,

    -- How often this tool should be replaced (in days)
    -- NULL if requires_replacement = FALSE
    -- e.g. 30 = replace every 30 days
    replacement_interval_days INT           NULL,

    -- ── STATUS ───────────────────────────────────────────────

    -- Controls ordering in dropdowns and tool selection forms
    display_order           INT             NOT NULL DEFAULT 0,

    -- FALSE = tool retired/no longer used
    -- Soft delete — never hard delete if referenced in SOPs
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,

    -- ── AUDIT FIELDS ─────────────────────────────────────────

    created_by              UUID            NULL REFERENCES tenant_pharmacore.users(id)
                                                ON DELETE SET NULL,

    updated_by              UUID            NULL REFERENCES tenant_pharmacore.users(id)
                                                ON DELETE SET NULL,

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()

);

-- ── INDEXES ──────────────────────────────────────────────────

-- Lookup by code — used in imports and API queries
CREATE INDEX IF NOT EXISTS idx_cleaning_equip_code
    ON tenant_pharmacore.cleaning_equipment (equipment_code);

-- Filter by cleaning type — dropdown shows only relevant tools
-- e.g. when SOP step is "Dry" → show only dry and general tools
CREATE INDEX IF NOT EXISTS idx_cleaning_equip_type
    ON tenant_pharmacore.cleaning_equipment (cleaning_type);

-- Active tools only — used in all SOP step dropdowns
CREATE INDEX IF NOT EXISTS idx_cleaning_equip_active
    ON tenant_pharmacore.cleaning_equipment (is_active)
    WHERE is_active = TRUE;

-- Ordered display in dropdowns
CREATE INDEX IF NOT EXISTS idx_cleaning_equip_order
    ON tenant_pharmacore.cleaning_equipment (display_order, equipment_name);

-- Full text search — search bar on list screen
CREATE INDEX IF NOT EXISTS idx_cleaning_equip_search
    ON tenant_pharmacore.cleaning_equipment USING gin (
        to_tsvector('english',
            equipment_name || ' ' || COALESCE(equipment_details, ''))
    );

-- ── COMMENTS ─────────────────────────────────────────────────

COMMENT ON TABLE cleaning_equipment IS
    'Master list of physical cleaning tools used in room and equipment cleaning SOPs.';

COMMENT ON COLUMN cleaning_equipment.cleaning_type IS
    'dry | wet | sanitizing | general. Used to filter relevant tools per SOP step.';

COMMENT ON COLUMN cleaning_equipment.requires_replacement IS
    'If TRUE, the replacement_interval_days column drives periodic replacement alerts.';

COMMENT ON COLUMN cleaning_equipment.replacement_interval_days IS
    'How often this tool should be replaced. NULL if requires_replacement is FALSE.';


-- ============================================================
-- TABLE 2: cleaning_sop_step_tools
-- Junction table linking cleaning tools to SOP cleaning steps
--
-- WHY THIS APPROACH:
--   One SOP step uses many tools: "Bucket, Mop, Scrub brush"
--   One tool appears in many SOP steps across different SOPs
--   This is a true many-to-many relationship
--
-- HOW IT WORKS:
--   Instead of storing "Bucket, Mop" as a text string in the
--   SOP step row, we store one row per tool per step here.
--   The UI joins this table to display the comma list.
--
-- WHICH SOP STEPS DOES IT LINK TO?
--   It uses a flexible design with sop_step_type to support
--   both room cleaning SOP steps and equipment cleaning SOP steps
--   without needing two separate junction tables.
--   When the SOP module is built, the step UUIDs from either
--   room_cleaning_sop or equipment_cleaning_sop are stored here.
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_pharmacore.cleaning_sop_step_tools (

    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Which cleaning tool is being linked
    -- CASCADE DELETE: if a tool is removed, its step links go too
    -- (should rarely happen — prefer deactivating tools)
    cleaning_equipment_id   UUID            NOT NULL
                                REFERENCES tenant_pharmacore.cleaning_equipment(id)
                                ON DELETE CASCADE,

    -- UUID of the SOP step row this tool is linked to
    -- Points to either:
    --   room_cleaning_sop.id       (when sop_step_type = 'room')
    --   equipment_cleaning_sop.id  (when sop_step_type = 'equipment')
    -- No FK constraint here because it references two different tables
    -- Application enforces referential integrity
    sop_step_id             UUID            NOT NULL,

    -- Which SOP step table the sop_step_id belongs to
    -- 'room'      → room_cleaning_sop table
    -- 'equipment' → equipment_cleaning_sop table
    sop_step_type           VARCHAR(20)     NOT NULL
                                CHECK (sop_step_type IN (
                                    'room',
                                    'equipment'
                                )),

    -- Who linked this tool to this step
    created_by              UUID            NULL REFERENCES tenant_pharmacore.users(id)
                                                ON DELETE SET NULL,

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()

    -- No updated_at — this is a link record
    -- To change which tools a step uses:
    --   DELETE the old links and INSERT new ones
    -- This preserves a clean audit of exactly what changed

);

-- ── UNIQUE CONSTRAINT ────────────────────────────────────────

-- One tool can only be linked to one step once
-- Prevents duplicate "Mop, Mop" appearing in the same step
CREATE UNIQUE INDEX IF NOT EXISTS idx_step_tools_unique
    ON tenant_pharmacore.cleaning_sop_step_tools (sop_step_id, cleaning_equipment_id, sop_step_type);

-- ── INDEXES ──────────────────────────────────────────────────

-- Get all tools for a given SOP step — used when rendering step rows
-- This is the most frequent query on this table
CREATE INDEX IF NOT EXISTS idx_step_tools_step
    ON tenant_pharmacore.cleaning_sop_step_tools (sop_step_id, sop_step_type);

-- Get all SOP steps that use a given tool
-- Used for impact analysis: "if I retire this mop,
-- which SOP steps will be affected?"
CREATE INDEX IF NOT EXISTS idx_step_tools_equipment
    ON tenant_pharmacore.cleaning_sop_step_tools (cleaning_equipment_id);

-- ── COMMENTS ─────────────────────────────────────────────────

COMMENT ON TABLE tenant_pharmacore.cleaning_sop_step_tools IS
    'Junction table — links cleaning tools to SOP cleaning steps. Replaces the comma-separated Equipment Used text column.';

COMMENT ON COLUMN tenant_pharmacore.cleaning_sop_step_tools.sop_step_id IS
    'UUID of the step row in either room_cleaning_sop or equipment_cleaning_sop table.';

COMMENT ON COLUMN tenant_pharmacore.cleaning_sop_step_tools.sop_step_type IS
    'room = room_cleaning_sop table. equipment = equipment_cleaning_sop table.';


-- ── AUTO-UPDATE TRIGGER ───────────────────────────────────────

CREATE OR REPLACE TRIGGER trg_cleaning_equipment_updated_at
    BEFORE UPDATE ON tenant_pharmacore.cleaning_equipment
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SEED DATA — Cleaning Equipment
-- Derived from the "Equipment Used" column values visible
-- across all your SOP screens (images 4, 5, 12, 14, 15)
--
-- From Room Cleaning SOP (image 14):
--   Hand brush, Dust pan, Bucket, Mop, Scrub brush,
--   Spray pump, Microfiber cloth
--
-- From Equipment Cleaning SOP (image 4):
--   Dust pan, Hand brush, Bucket, Mop, Scrub brush,
--   Spray pump, Clean cloth
--
-- From Room Inspection SOP (image 12) — implied tools
-- From Equipment Inspection SOP (image 5) — implied tools
-- ============================================================

INSERT INTO tenant_pharmacore.cleaning_equipment
    (equipment_code, equipment_name, equipment_details,
     cleaning_type, material,
     requires_replacement, replacement_interval_days,
     display_order, is_active)
VALUES

    -- ── DRY CLEANING TOOLS ────────────────────────────────────

    (
        'CE-001', 'Dust Pan',
        'Used to collect dust and loose particles swept from surfaces and floors.',
        'dry', 'Polypropylene',
        TRUE, 90,
        1, TRUE
    ),
    (
        'CE-002', 'Hand Brush',
        'Used to sweep loose material and dust from equipment surfaces and corners.',
        'dry', 'Nylon bristles, Polypropylene handle',
        TRUE, 60,
        2, TRUE
    ),
    (
        'CE-003', 'Soft Bristle Brush',
        'Gentle brush for cleaning delicate equipment surfaces without scratching.',
        'dry', 'Soft nylon bristles',
        TRUE, 90,
        3, TRUE
    ),
    (
        'CE-004', 'Vacuum Cleaner',
        'Industrial vacuum for removing fine powder and dust particles from equipment and floors.',
        'dry', 'Stainless Steel body',
        FALSE, NULL,
        4, TRUE
    ),

    -- ── WET CLEANING TOOLS ────────────────────────────────────

    (
        'CE-005', 'Mop',
        'Used for applying cleaning solution and scrubbing floor surfaces during wet cleaning.',
        'wet', 'Microfiber or Cotton head, Aluminium handle',
        TRUE, 30,
        5, TRUE
    ),
    (
        'CE-006', 'Bucket',
        'Used to hold cleaning solution during wet cleaning operations.',
        'wet', 'High-density Polyethylene',
        FALSE, NULL,
        6, TRUE
    ),
    (
        'CE-007', 'Scrub Brush',
        'Used for scrubbing stubborn stains and residue from floor and wall surfaces.',
        'wet', 'Stiff nylon bristles, Polypropylene handle',
        TRUE, 60,
        7, TRUE
    ),
    (
        'CE-008', 'Microfiber Cloth',
        'Used for wiping surfaces after cleaning solution application. Does not leave lint or fibres.',
        'wet', 'Microfiber',
        TRUE, 14,
        8, TRUE
    ),
    (
        'CE-009', 'Clean Cloth',
        'General purpose wiping cloth for equipment surface cleaning.',
        'wet', 'Cotton or Polyester blend',
        TRUE, 7,
        9, TRUE
    ),
    (
        'CE-010', 'Sponge',
        'Used for applying and spreading cleaning solution on equipment surfaces.',
        'wet', 'Polyurethane foam',
        TRUE, 14,
        10, TRUE
    ),

    -- ── SANITIZING TOOLS ─────────────────────────────────────

    (
        'CE-011', 'Spray Pump',
        'Used to apply disinfectant or sanitizing solution evenly across surfaces.',
        'sanitizing', 'HDPE bottle, Polypropylene pump',
        TRUE, 180,
        11, TRUE
    ),
    (
        'CE-012', 'Pressure Sprayer',
        'Used for large area sanitization with disinfectant solution under pressure.',
        'sanitizing', 'Stainless Steel tank, HDPE nozzle',
        FALSE, NULL,
        12, TRUE
    ),
    (
        'CE-013', 'Trigger Sprayer',
        'Small handheld sprayer for targeted disinfectant application on specific surfaces.',
        'sanitizing', 'HDPE',
        TRUE, 90,
        13, TRUE
    )

ON CONFLICT (equipment_code) DO NOTHING;


-- ============================================================
-- VERIFICATION QUERIES
-- Run after seeding to confirm data is correct
-- ============================================================

-- Full list matching the UI list screen layout
SELECT
    ROW_NUMBER() OVER (ORDER BY display_order)  AS "S.No",
    equipment_code                               AS "Code",
    equipment_name                               AS "Tool Name",
    cleaning_type                               AS "Cleaning Type",
    material                                    AS "Material",
    requires_replacement                        AS "Needs Replacement",
    replacement_interval_days                   AS "Replace Every (days)",
    is_active                                   AS "Active"
FROM cleaning_equipment
ORDER BY display_order;

-- Count by cleaning type
SELECT
    cleaning_type               AS "Type",
    COUNT(*)                    AS "Total Tools",
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END) AS "Active"
FROM cleaning_equipment
GROUP BY cleaning_type
ORDER BY cleaning_type;

-- Summary
SELECT
    'cleaning_equipment'        AS "Table",
    COUNT(*)                    AS "Total Rows",
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END) AS "Active"
FROM cleaning_equipment
UNION ALL
SELECT
    'cleaning_sop_step_tools',
    COUNT(*), NULL
FROM cleaning_sop_step_tools;

-- ============================================================
-- HOW TO USE cleaning_sop_step_tools
-- Example queries for when SOP steps are built
-- ============================================================

-- Get all tools for a specific SOP step (room cleaning)
-- SELECT ce.equipment_name, ce.cleaning_type
-- FROM cleaning_sop_step_tools cst
-- JOIN cleaning_equipment ce ON ce.id = cst.cleaning_equipment_id
-- WHERE cst.sop_step_id = '<room_cleaning_sop step UUID>'
--   AND cst.sop_step_type = 'room'
-- ORDER BY ce.display_order;

-- Get all SOP steps that use a Mop
-- SELECT cst.sop_step_id, cst.sop_step_type
-- FROM cleaning_sop_step_tools cst
-- JOIN cleaning_equipment ce ON ce.id = cst.cleaning_equipment_id
-- WHERE ce.equipment_name = 'Mop';

-- ============================================================
-- END OF FILE
-- ============================================================