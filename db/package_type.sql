-- ============================================================
-- DIGILOG — Packaging Types Module
-- PostgreSQL 15+
--
-- WHAT THIS FILE CONTAINS:
--   TABLE 1 : packaging_types
--             Master list of packaging formats used for
--             finished pharmaceutical products
--             e.g. PT-001 Blister pack, PT-002 Plastic bottle
--
-- WHERE IT LIVES:
--   Tenant schema — e.g. tenant_pharmacore, tenant_medsync
--   Run after digilog_login.sql (users table must exist)
--
-- WHAT IS A PACKAGING TYPE?
--   The physical format used to package finished medicine.
--   Set by admin during initial configuration.
--   Used later in:
--     → batches.packaging_type_id
--         "This batch of Paracetamol will be packed
--          in blister packs"
--     → batch_packing.packaging_type_id
--         "Actual packaging used when packing happened"
--   The two FK references serve different purposes:
--     batches     = intended packaging (set at batch creation)
--     batch_packing = actual packaging (recorded during packing)
--   Any mismatch between the two is a GMP deviation.
--
-- DEPENDS ON:
--   users table — for created_by, updated_by audit fields
-- ============================================================


-- ============================================================
-- TABLE 1: packaging_types
-- Pure master / lookup table
-- Admin configures once — operators select from dropdowns
-- ============================================================

CREATE TABLE IF NOT EXISTS packaging_types (

    -- ── IDENTIFIERS ──────────────────────────────────────────

    -- Internal UUID — used as FK in batches and batch_packing
    id                          UUID            PRIMARY KEY
                                                DEFAULT uuid_generate_v4(),

    -- Human-readable code shown in the UI and reports
    -- Format: PT-001, PT-002, PT-003 etc.
    -- Application generates — DB enforces uniqueness
    packaging_type_id           VARCHAR(20)     NOT NULL UNIQUE,

    -- Short display name shown in dropdowns
    -- e.g. "Blister Pack", "Plastic Bottle", "Alu-Alu Strip"
    packaging_type_name         VARCHAR(150)    NOT NULL UNIQUE,

    -- Full description of the packaging format
    -- Shown in the Packaging Type Details column on list screen
    -- e.g. "Thermoformed plastic pack with aluminum foil backing"
    packaging_type_details      TEXT            NULL,

    -- ── CLASSIFICATION ───────────────────────────────────────

    -- Primary packaging material category
    -- Drives regulatory requirements and batch checks
    -- Values:
    --   blister     → Blister packs (PVC/Alu, Alu/Alu)
    --   bottle      → Plastic or glass bottles
    --   sachet      → Single-use powder or liquid sachets
    --   strip       → Strip packs (foil-based)
    --   vial        → Injectable vials
    --   ampoule     → Sealed glass ampoules
    --   tube        → Ointment or cream tubes
    --   pouch       → Flexible laminate pouches
    --   other       → Any other packaging format
    packaging_category          VARCHAR(20)     NULL
                                    CHECK (packaging_category IN (
                                        'blister',
                                        'bottle',
                                        'sachet',
                                        'strip',
                                        'vial',
                                        'ampoule',
                                        'tube',
                                        'pouch',
                                        'other'
                                    )),

    -- Primary material used
    -- Important for stability studies and storage conditions
    -- e.g. "PVC/Aluminium", "HDPE", "Glass Type II"
    primary_material            VARCHAR(100)    NULL,

    -- Unit of measure for quantity when packing
    -- e.g. "Tablets per blister", "ml per bottle", "g per sachet"
    -- Used in batch_packing to record pack quantities correctly
    pack_unit                   VARCHAR(50)     NULL,

    -- Standard pack size for this packaging type
    -- e.g. 10 (tablets per blister), 100 (tablets per bottle)
    -- Reference value — actual quantity recorded in batch_packing
    standard_pack_size          INT             NULL,

    -- Whether this packaging requires specific storage conditions
    -- e.g. "Store below 25°C", "Keep away from moisture"
    -- Displayed on batch release documentation
    storage_conditions          VARCHAR(150)    NULL,

    -- ── ORDERING AND STATUS ───────────────────────────────────

    -- Controls order in batch creation dropdowns
    display_order               INT             NOT NULL DEFAULT 0,

    -- FALSE = packaging type retired / no longer used
    -- Cannot hard-delete if referenced in batches
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,

    -- ── AUDIT FIELDS ─────────────────────────────────────────

    created_by                  UUID            NULL
                                    REFERENCES users(id)
                                    ON DELETE SET NULL,

    updated_by                  UUID            NULL
                                    REFERENCES users(id)
                                    ON DELETE SET NULL,

    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()

);

-- ── INDEXES ──────────────────────────────────────────────────

-- Lookup by packaging_type_id — used in CSV imports and API
CREATE INDEX IF NOT EXISTS idx_packaging_types_type_id
    ON packaging_types (packaging_type_id);

-- Filter active types — used in batch creation dropdown
CREATE INDEX IF NOT EXISTS idx_packaging_types_active
    ON packaging_types (is_active)
    WHERE is_active = TRUE;

-- Filter by category — used in reporting
-- e.g. "Show all blister pack batches this month"
CREATE INDEX IF NOT EXISTS idx_packaging_types_category
    ON packaging_types (packaging_category)
    WHERE packaging_category IS NOT NULL;

-- Ordered display in dropdowns
CREATE INDEX IF NOT EXISTS idx_packaging_types_order
    ON packaging_types (display_order, packaging_type_name);

-- Full text search — search bar on the list screen
CREATE INDEX IF NOT EXISTS idx_packaging_types_search
    ON packaging_types USING gin (
        to_tsvector('english',
            packaging_type_name || ' ' ||
            COALESCE(packaging_type_details, ''))
    );

-- ── COMMENTS ─────────────────────────────────────────────────

COMMENT ON TABLE packaging_types IS
    'Master list of packaging formats for finished pharmaceutical products. Used in batch creation and batch packing records.';

COMMENT ON COLUMN packaging_types.packaging_type_id IS
    'Human-readable code e.g. PT-001. Generated by application, enforced unique by DB.';

COMMENT ON COLUMN packaging_types.packaging_category IS
    'Material category: blister, bottle, sachet, strip, vial, ampoule, tube, pouch, other.';

COMMENT ON COLUMN packaging_types.pack_unit IS
    'Unit of measure for packing quantity e.g. Tablets per blister, ml per bottle.';

COMMENT ON COLUMN packaging_types.standard_pack_size IS
    'Reference pack size. Actual quantity recorded in batch_packing at time of packing.';

COMMENT ON COLUMN packaging_types.storage_conditions IS
    'Storage requirements shown on batch release documentation.';


-- ── AUTO-UPDATE TRIGGER ───────────────────────────────────────

CREATE OR REPLACE TRIGGER trg_packaging_types_updated_at
    BEFORE UPDATE ON packaging_types
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SEED DATA
-- 4 packaging types visible in your screen (image 8)
-- Plus common pharma packaging types for completeness
-- Admin can add more, edit details, or deactivate any
-- ============================================================

INSERT INTO packaging_types (
    packaging_type_id,
    packaging_type_name,
    packaging_type_details,
    packaging_category,
    primary_material,
    pack_unit,
    standard_pack_size,
    storage_conditions,
    display_order,
    is_active
)
VALUES

    -- ── FROM YOUR SCREEN (image 8) ────────────────────────────

    (
        'PT-001',
        'Blister Pack',
        'Thermoformed plastic pack with aluminum foil backing. Most common packaging for solid oral dosage forms like tablets and capsules.',
        'blister',
        'PVC / Aluminium foil',
        'Tablets per blister',
        10,
        'Store below 30°C. Protect from moisture.',
        1, TRUE
    ),
    (
        'PT-002',
        'Plastic Bottle',
        'Plastic bottle used for liquid or tablet storage. Suitable for syrups, suspensions, and high-quantity tablet packs.',
        'bottle',
        'High-density Polyethylene (HDPE)',
        'ml per bottle',
        100,
        'Store below 25°C. Keep away from direct sunlight.',
        2, TRUE
    ),
    (
        'PT-003',
        'Alu-Alu Strip Pack',
        'Alu-Alu strip pack for tablet blistering. Both sides aluminium foil — superior moisture and light barrier. Used for hygroscopic products.',
        'strip',
        'Aluminium / Aluminium foil',
        'Tablets per strip',
        10,
        'Store below 25°C. Protect from moisture and light.',
        3, TRUE
    ),
    (
        'PT-004',
        'Sachet',
        'Single-use sachet pack for powder or granule products. Used for oral rehydration salts, protein powders, and granule formulations.',
        'sachet',
        'Aluminium laminate / LDPE',
        'g per sachet',
        5,
        'Store below 30°C. Keep in a dry place.',
        4, TRUE
    ),

    -- ── ADDITIONAL COMMON PHARMA PACKAGING ───────────────────

    (
        'PT-005',
        'Glass Bottle',
        'Amber glass bottle for light-sensitive liquid formulations including injectable solutions and syrups requiring glass packaging.',
        'bottle',
        'Type II Amber Glass',
        'ml per bottle',
        200,
        'Store below 25°C. Protect from light.',
        5, TRUE
    ),
    (
        'PT-006',
        'Vial',
        'Glass vial for injectable pharmaceutical products. Sealed with rubber stopper and aluminium crimp cap.',
        'vial',
        'Type I Borosilicate Glass',
        'ml per vial',
        10,
        'Store at 2-8°C. Do not freeze.',
        6, TRUE
    ),
    (
        'PT-007',
        'Ampoule',
        'Sealed glass ampoule for single-dose injectable solutions. Break-open design with no stopper.',
        'ampoule',
        'Type I Borosilicate Glass',
        'ml per ampoule',
        2,
        'Store at controlled room temperature 15-25°C.',
        7, TRUE
    ),
    (
        'PT-008',
        'Tube',
        'Laminated tube for semi-solid formulations including ointments, creams, and gels.',
        'tube',
        'Aluminium laminate / LDPE',
        'g per tube',
        30,
        'Store below 25°C. Do not refrigerate.',
        8, TRUE
    ),
    (
        'PT-009',
        'HDPE Jar',
        'Wide-mouth HDPE jar for bulk tablet or capsule packing. Used for institutional and hospital supply.',
        'bottle',
        'High-density Polyethylene (HDPE)',
        'Tablets per jar',
        500,
        'Store below 30°C. Keep tightly closed.',
        9, TRUE
    ),
    (
        'PT-010',
        'Strip Pack',
        'PVC or foil strip pack sealed with heat. Simpler and lower-cost alternative to blister packs for less moisture-sensitive products.',
        'strip',
        'PVC / Aluminium foil',
        'Tablets per strip',
        10,
        'Store below 30°C. Protect from moisture.',
        10, TRUE
    )

ON CONFLICT (packaging_type_id) DO NOTHING;


-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Full list matching the UI list screen layout
SELECT
    ROW_NUMBER() OVER (ORDER BY display_order)  AS "S.No",
    packaging_type_id                           AS "Packaging Type",
    packaging_type_name                         AS "Name",
    packaging_type_details                      AS "Packaging Type Details",
    packaging_category                          AS "Category",
    primary_material                            AS "Material",
    standard_pack_size                          AS "Std Pack Size",
    pack_unit                                   AS "Pack Unit",
    is_active                                   AS "Active"
FROM packaging_types
ORDER BY display_order;

-- Count by category
SELECT
    COALESCE(packaging_category, 'Uncategorised')   AS "Category",
    COUNT(*)                                        AS "Total",
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END)      AS "Active"
FROM packaging_types
GROUP BY packaging_category
ORDER BY MIN(display_order);

-- Summary
SELECT
    'packaging_types'   AS "Table",
    COUNT(*)            AS "Total Rows",
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END) AS "Active Rows"
FROM packaging_types;

-- ============================================================
-- END OF FILE
-- ============================================================