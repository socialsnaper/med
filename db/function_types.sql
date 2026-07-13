-- ============================================================
-- DIGILOG — Function Types Module
-- PostgreSQL 15+
--
-- WHAT THIS FILE CONTAINS:
--   TABLE 1 : function_types
--             Master list of job function categories
--             e.g. FT-001 Supervision, FT-002 Operation
--
-- WHERE IT LIVES:
--   Tenant schema — e.g. tenant_pharmacore, tenant_medsync
--   Run after digilog_login.sql (users table must exist)
--
-- WHAT IS A FUNCTION TYPE?
--   The category of work a person performs on the factory floor.
--   Answers the question: "What kind of work does this person do?"
--
--   From your screen (image 7), the 7 function types are:
--     1. Supervision   — Overseeing and guiding activities
--     2. Operation     — Executing core production activities
--     3. Management    — Planning and coordinating resources
--     4. Cleaning      — Removing dust, residue, contaminants
--     5. Sanitization  — Killing microorganisms for hygiene
--     6. Maintenance   — Inspecting and servicing equipment
--     7. QC            — Checking and verifying compliance
--
--   Used in:
--     → user_assignments.functioning_type_id
--         "Rahul Sharma's function is Production Execution"
--         (seen in User Details screen image 18)
--     → batch_process_steps
--         Determines which employees can sign off each step
--         e.g. only QC function can sign QA approval
--     → cleaning logs
--         Only Cleaning function can sign cleaning steps
--
-- DEPENDS ON:
--   users table — for created_by, updated_by audit fields
-- ============================================================


-- ============================================================
-- TABLE 1: function_types
-- Pure master / lookup table
-- Admin configures — used in user assignments and batch steps
-- ============================================================

CREATE TABLE IF NOT EXISTS function_types (

    -- ── IDENTIFIERS ──────────────────────────────────────────

    -- Internal UUID — used as FK in user_assignments
    id                      UUID            PRIMARY KEY
                                            DEFAULT uuid_generate_v4(),

    -- Human-readable code shown in the UI
    -- Format: FT-001, FT-002 etc.
    -- Application generates — DB enforces uniqueness
    function_type_id        VARCHAR(20)     NOT NULL UNIQUE,

    -- Short name shown in dropdowns and the User Details screen
    -- e.g. "Supervision", "Operation", "QC"
    function_type_name      VARCHAR(100)    NOT NULL UNIQUE,

    -- Full description shown in the Function Type Details column
    -- on the Functioning Type list screen (image 7)
    function_type_details   TEXT            NULL,

    -- ── CLASSIFICATION ───────────────────────────────────────

    -- Whether users with this function type can perform
    -- sign-off actions on batch process steps
    -- TRUE  = this function type has sign-off authority
    -- FALSE = execution only, cannot sign off steps
    --
    -- Examples:
    --   Supervision  → TRUE  (supervisors sign off steps)
    --   Operation    → FALSE (operators execute, don't sign off)
    --   Management   → TRUE  (managers sign off)
    --   Cleaning     → FALSE (cleaners execute cleaning steps)
    --   Sanitization → FALSE (execution only)
    --   Maintenance  → FALSE (execution only)
    --   QC           → TRUE  (QC signs off quality steps)
    can_sign_off            BOOLEAN         NOT NULL DEFAULT FALSE,

    -- Whether users with this function type can be assigned
    -- as the operator on batch process steps
    -- TRUE  = can be assigned as operator for batch steps
    -- FALSE = cannot be assigned to production steps
    --
    -- Examples:
    --   Operation    → TRUE  (operators run batch steps)
    --   Cleaning     → FALSE (not assigned to production steps)
    --   QC           → FALSE (they verify, not operate)
    --   Maintenance  → FALSE (they service equipment)
    can_operate_batch       BOOLEAN         NOT NULL DEFAULT FALSE,

    -- Whether users with this function type can perform
    -- cleaning and sanitization log entries
    -- TRUE  = can record cleaning events
    -- FALSE = cannot record cleaning
    --
    -- Examples:
    --   Cleaning     → TRUE  (cleaners record cleaning logs)
    --   Sanitization → TRUE  (sanitizers record sanit. logs)
    --   Operation    → FALSE (operators don't clean rooms)
    can_perform_cleaning    BOOLEAN         NOT NULL DEFAULT FALSE,

    -- Whether this function type can perform maintenance
    -- activities on equipment
    -- TRUE  = can record equipment maintenance logs
    -- FALSE = cannot record maintenance
    --
    -- Examples:
    --   Maintenance  → TRUE  (technicians log maintenance)
    --   Operation    → FALSE (operators don't maintain)
    can_perform_maintenance BOOLEAN         NOT NULL DEFAULT FALSE,

    -- ── ORDERING AND STATUS ───────────────────────────────────

    -- Controls order in dropdowns and list screen
    display_order           INT             NOT NULL DEFAULT 0,

    -- FALSE = soft-deleted, hidden from UI
    -- Never hard-delete — may be referenced in user_assignments
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,

    -- ── AUDIT FIELDS ─────────────────────────────────────────

    created_by              UUID            NULL
                                REFERENCES users(id)
                                ON DELETE SET NULL,

    updated_by              UUID            NULL
                                REFERENCES users(id)
                                ON DELETE SET NULL,

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()

);

-- ── INDEXES ──────────────────────────────────────────────────

-- Lookup by function_type_id — used in imports and API
CREATE INDEX IF NOT EXISTS idx_function_types_type_id
    ON function_types (function_type_id);

-- Active types only — used in user assignment dropdowns
CREATE INDEX IF NOT EXISTS idx_function_types_active
    ON function_types (is_active)
    WHERE is_active = TRUE;

-- Filter by capability — used in batch step assignment
-- e.g. "Show only function types that can sign off"
CREATE INDEX IF NOT EXISTS idx_function_types_signoff
    ON function_types (can_sign_off)
    WHERE can_sign_off = TRUE;

-- Filter by cleaning capability
CREATE INDEX IF NOT EXISTS idx_function_types_cleaning
    ON function_types (can_perform_cleaning)
    WHERE can_perform_cleaning = TRUE;

-- Ordered display in dropdowns
CREATE INDEX IF NOT EXISTS idx_function_types_order
    ON function_types (display_order, function_type_name);

-- ── COMMENTS ─────────────────────────────────────────────────

COMMENT ON TABLE function_types IS
    'Master list of job function categories. Determines what activities a user can perform and sign off in DIGILOG.';

COMMENT ON COLUMN function_types.function_type_id IS
    'Human-readable code e.g. FT-001. Generated by application, enforced unique by DB.';

COMMENT ON COLUMN function_types.can_sign_off IS
    'TRUE = users with this function can digitally sign off batch and cleaning steps.';

COMMENT ON COLUMN function_types.can_operate_batch IS
    'TRUE = users with this function can be assigned as operator on batch process steps.';

COMMENT ON COLUMN function_types.can_perform_cleaning IS
    'TRUE = users with this function can record room and equipment cleaning log entries.';

COMMENT ON COLUMN function_types.can_perform_maintenance IS
    'TRUE = users with this function can record equipment maintenance log entries.';


-- ── AUTO-UPDATE TRIGGER ───────────────────────────────────────

CREATE OR REPLACE TRIGGER trg_function_types_updated_at
    BEFORE UPDATE ON function_types
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SEED DATA
-- The 7 function types from your screen (image 7)
-- Capability flags set based on GMP logic
-- ============================================================

INSERT INTO function_types (
    function_type_id,
    function_type_name,
    function_type_details,
    can_sign_off,
    can_operate_batch,
    can_perform_cleaning,
    can_perform_maintenance,
    display_order,
    is_active
)
VALUES

    (
        'FT-001',
        'Supervision',
        'Overseeing and guiding activities to ensure work is performed as per standards.',
        TRUE,   -- supervisors sign off steps
        FALSE,  -- supervisors don't operate machines directly
        FALSE,  -- supervisors don't perform cleaning
        FALSE,  -- supervisors don't perform maintenance
        1, TRUE
    ),
    (
        'FT-002',
        'Operation',
        'Executing core activities to achieve production or process goals.',
        FALSE,  -- operators execute, supervisors sign off
        TRUE,   -- operators run batch process steps
        FALSE,  -- operators don't clean rooms (cleaners do)
        FALSE,  -- operators don't maintain equipment
        2, TRUE
    ),
    (
        'FT-003',
        'Management',
        'Planning, coordinating and controlling resources and activities.',
        TRUE,   -- managers sign off and approve
        FALSE,  -- managers don't operate machines
        FALSE,  -- managers don't perform cleaning
        FALSE,  -- managers don't perform maintenance
        3, TRUE
    ),
    (
        'FT-004',
        'Cleaning',
        'Removing dust, residue or contaminants to maintain cleanliness.',
        FALSE,  -- cleaners execute, QC signs off
        FALSE,  -- cleaners not assigned to batch steps
        TRUE,   -- cleaners record cleaning logs
        FALSE,  -- cleaners don't maintain equipment
        4, TRUE
    ),
    (
        'FT-005',
        'Sanitization',
        'Killing or removing microorganisms to ensure hygiene and safety.',
        FALSE,  -- sanitizers execute, QC verifies
        FALSE,  -- not assigned to batch production steps
        TRUE,   -- sanitizers record cleaning/sanit logs
        FALSE,  -- not maintenance
        5, TRUE
    ),
    (
        'FT-006',
        'Maintenance',
        'Inspecting, servicing and repairing equipment for optimal performance.',
        FALSE,  -- maintenance does not sign off production
        FALSE,  -- not assigned to batch production steps
        FALSE,  -- not cleaning (different activity)
        TRUE,   -- maintenance records equipment logs
        6, TRUE
    ),
    (
        'FT-007',
        'QC',
        'Checking and verifying quality to ensure compliance with standards.',
        TRUE,   -- QC signs off quality checks
        FALSE,  -- QC does not operate production
        FALSE,  -- QC does not clean
        FALSE,  -- QC does not maintain equipment
        7, TRUE
    )

ON CONFLICT (function_type_id) DO NOTHING;


-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Full list matching the UI list screen (image 7)
SELECT
    ROW_NUMBER() OVER (ORDER BY display_order)  AS "S.No",
    function_type_id                            AS "Function Type ID",
    function_type_name                          AS "Function Type Name",
    function_type_details                       AS "Function Type Details",
    can_sign_off                                AS "Can Sign Off",
    can_operate_batch                           AS "Can Operate Batch",
    can_perform_cleaning                        AS "Can Clean",
    can_perform_maintenance                     AS "Can Maintain",
    is_active                                   AS "Active"
FROM function_types
ORDER BY display_order;

-- Capability summary — useful for admin review
SELECT
    function_type_name                          AS "Function",
    CASE WHEN can_sign_off          THEN '✓' ELSE '—' END AS "Sign Off",
    CASE WHEN can_operate_batch     THEN '✓' ELSE '—' END AS "Batch Ops",
    CASE WHEN can_perform_cleaning  THEN '✓' ELSE '—' END AS "Cleaning",
    CASE WHEN can_perform_maintenance THEN '✓' ELSE '—' END AS "Maintenance"
FROM function_types
ORDER BY display_order;

-- Summary count
SELECT
    'function_types'    AS "Table",
    COUNT(*)            AS "Total Rows",
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END) AS "Active Rows"
FROM function_types;

-- ============================================================
-- END OF FILE
-- ============================================================