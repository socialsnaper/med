-- ============================================================
-- DIGILOG — Room Cleaning SOP Steps Module
-- PostgreSQL 15+
--
-- SOURCE: User Story document
--         "012 - User Story - Room Cleaning SOP Steps.docx"
--
-- WHAT THIS FILE CONTAINS:
--   TABLE 1 : room_cleaning_types
--             Master list of cleaning types
--             e.g. "Area Cleaning", "Deep Cleaning", "Sanitization"
--             Admin-controlled — no dev involvement needed
--
--   TABLE 2 : room_cleaning_sop_steps
--             The SOP step template for each cleaning type
--             One row = one step in a cleaning procedure
--             These are TEMPLATES — used as source during actual
--             room cleaning events (AC4)
--
--   TABLE 3 : room_cleaning_sop_step_media
--             Up to 3 pictures/files per SOP step (AC1.1 View Links)
--             Separate table — one row per media attachment
--
--   TABLE 4 : room_cleaning_sop_step_chemicals
--             Normalised chemical used per step
--             (replaces free-text Chemical Used column)
--
--   TABLE 5 : room_cleaning_sop_step_audit
--             Every ADD/UPDATE/DELETE must be authorized by a
--             higher-role user (document requirement)
--             Full audit trail of who changed what and who approved
--
-- ============================================================
-- KEY FINDINGS FROM REQUIREMENTS DOCUMENT
-- ============================================================
--
-- AC1.1 COLUMNS (exact from document):
--   S.No                 → auto-generated, auto-adjusted on delete
--   Cleaning Type        → FK to room_cleaning_types
--   Step No.             → manual ordering within a cleaning type
--   Time Allotted        → duration for this step
--   Dry/Wet/San Type     → Type A / Type B / Type C (from doc)
--   Before/After Equ.    → NEW field not on screen — whether this
--                          step runs before or after equipment cleaning
--   Procedure            → text description of what to do
--   Chemical Used        → chemical(s) used in this step
--   Equipment Used       → FK to cleaning_equipment table
--   View Links           → up to 3 pictures/files (AC1.1)
--
-- AC4 — TEMPLATE BEHAVIOUR:
--   These steps are TEMPLATES. When a room cleaning event starts
--   and a cleaning type is selected, ALL steps for that cleaning
--   type are dynamically loaded in sequence. Operators follow them
--   one by one and record completion. The template itself is never
--   modified during cleaning — only the log records completion.
--
-- AC5/AC6 — IMPORT/EXPORT:
--   Bulk Excel import and export must be supported.
--   Handled at application layer — no DB change needed.
--
-- AUTHORIZATION REQUIREMENT:
--   Every ADD/UPDATE/DELETE must be authorized by a higher-role user.
--   Implemented via step_audit table with authorized_by FK.
--   Status column on sop_steps controls pending/approved/rejected.
--
-- DEPENDS ON:
--   users table            — created_by, authorized_by
--   cleaning_equipment table — equipment_used FK
--   rooms table            — future link when step is room-specific
-- ============================================================


-- ============================================================
-- TABLE 1: room_cleaning_types
-- Master list of cleaning types
-- Supervisor adds/edits without developer involvement (AC1)
-- e.g. "Area Cleaning", "Deep Cleaning", "Sanitization", "CIP"
-- ============================================================
SET search_path TO tenant_pharmacore;
CREATE TABLE IF NOT EXISTS room_cleaning_types (

    id                      UUID            PRIMARY KEY
                                            DEFAULT gen_random_uuid(),

    -- Short code for this cleaning type
    -- e.g. "RC-001", "RC-002"
    cleaning_type_code      VARCHAR(20)     NOT NULL UNIQUE,

    -- Full name shown in dropdowns and step list
    -- e.g. "Area Cleaning", "Deep Cleaning", "Sanitization"
    cleaning_type_name      VARCHAR(150)    NOT NULL UNIQUE,

    -- Description of when this cleaning type is used
    cleaning_type_details   TEXT            NULL,

    -- Which Dry/Wet/San category this type falls under
    -- From document: Type A / Type B / Type C
    -- Type A = Dry cleaning
    -- Type B = Wet cleaning
    -- Type C = Sanitization
    -- A cleaning type itself has a default method
    -- but individual steps can override this
    default_method          VARCHAR(10)     NULL
                                CHECK (default_method IN (
                                    'TypeA',    -- Dry
                                    'TypeB',    -- Wet
                                    'TypeC'     -- Sanitization
                                )),

    -- Controls order in dropdown
    display_order           INT             NOT NULL DEFAULT 0,

    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,

    created_by              UUID            NULL
                                REFERENCES tenant_pharmacore.users(id)
                                ON DELETE SET NULL,

    updated_by              UUID            NULL
                                REFERENCES tenant_pharmacore.users(id)
                                ON DELETE SET NULL,

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS idx_room_cleaning_types_code
    ON room_cleaning_types (cleaning_type_code);

CREATE INDEX IF NOT EXISTS idx_room_cleaning_types_active
    ON room_cleaning_types (is_active)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_room_cleaning_types_order
    ON room_cleaning_types (display_order);

COMMENT ON TABLE room_cleaning_types IS
    'Master list of room cleaning types. Supervisor-controlled — no developer involvement needed to add/edit types.';

COMMENT ON COLUMN room_cleaning_types.default_method IS
    'Default Dry/Wet/San method for this type. TypeA=Dry, TypeB=Wet, TypeC=Sanitization. Individual steps can override.';


-- ============================================================
-- TABLE 2: room_cleaning_sop_steps
-- The SOP step TEMPLATES for each cleaning type
-- One row = one step in a cleaning procedure template
-- Used as source data when a room cleaning event starts (AC4)
-- ============================================================

CREATE TABLE IF NOT EXISTS room_cleaning_sop_steps (

    -- ── IDENTIFIERS ──────────────────────────────────────────

    id                      UUID            PRIMARY KEY
                                            DEFAULT gen_random_uuid(),

    -- Sequential display number — "S.No" column
    -- Auto-generated by application (AC1 — "S.No must be auto generated")
    -- Auto-adjusted when a step is deleted (AC2 — "S.No must be auto adjusted")
    -- We store it in DB but application manages renumbering on delete
    -- Stored per cleaning_type — restart from 1 for each type
    slid                    INT             NOT NULL,

    -- ── WHICH CLEANING TYPE THIS STEP BELONGS TO ─────────────

    -- "Cleaning Type" column from document (AC1.1)
    -- All steps for one cleaning type are loaded together
    -- when that type is selected during a cleaning event (AC4)
    cleaning_type_id        UUID            NOT NULL
                                REFERENCES room_cleaning_types(id)
                                ON DELETE RESTRICT,

    -- ── STEP ORDERING ────────────────────────────────────────

    -- "Step No." column from document (AC1.1)
    -- Controls the sequence operators follow during cleaning
    -- e.g. Step 1 = Remove loose material, Step 2 = Apply detergent
    -- Admin can reorder by changing step_number
    step_number             INT             NOT NULL,

    -- ── TIMING ───────────────────────────────────────────────

    -- "Time Allotted" column from document (AC1.1)
    -- How long this step should take
    -- Stored as INTERVAL for proper time arithmetic
    -- e.g. '00:05' = 5 minutes, '00:15' = 15 minutes
    time_allotted           INTERVAL        NULL,

    -- Display string for time — matches screen format "00:05"
    time_allotted_display   VARCHAR(10)     NULL,

    -- ── DRY/WET/SAN CLEANING METHOD ──────────────────────────

    -- "Dry/Wet/San Cleaning Type (Type A/Type B/Type C)"
    -- Exact field name from document (AC1.1)
    -- TypeA = Dry cleaning (no liquid)
    -- TypeB = Wet cleaning (water and detergent)
    -- TypeC = Sanitization (disinfectant application)
    -- Shown as "Dry/Wet/San" column on screen (image 14)
    cleaning_method         VARCHAR(10)     NOT NULL
                                CHECK (cleaning_method IN (
                                    'TypeA',    -- Dry
                                    'TypeB',    -- Wet
                                    'TypeC'     -- Sanitization / San
                                )),

    -- ── BEFORE OR AFTER EQUIPMENT CLEANING ───────────────────

    -- NEW FIELD from document (AC1.1) — NOT on the existing screen
    -- Critical for batch sequencing:
    --   "Before" = this room cleaning step must happen BEFORE
    --              equipment is cleaned in this room
    --   "After"  = this room cleaning step happens AFTER equipment
    --              has been cleaned
    --   "NA"     = not applicable / independent of equipment cleaning
    -- This determines the order of operations in the facility
    equipment_cleaning_sequence  VARCHAR(10) NOT NULL DEFAULT 'NA'
                                CHECK (equipment_cleaning_sequence IN (
                                    'Before',   -- before equipment cleaning
                                    'After',    -- after equipment cleaning
                                    'NA'        -- not applicable
                                )),

    -- ── PROCEDURE ────────────────────────────────────────────

    -- "Procedure" column from document (AC1.1)
    -- Detailed description of exactly what the operator must do
    -- e.g. "Remove loose material and dust using hand brush and dust pan"
    procedure_text          TEXT            NOT NULL,

    -- ── CHEMICAL USED ────────────────────────────────────────

    -- "Chemical Used" column from document (AC1.1)
    -- Free text for the chemical/cleaning agent used in this step
    -- e.g. "Detergent Solution", "Disinfectant Solution", "NA"
    -- Stored as free text here — chemicals master table is separate
    -- Admin may want to type freely without being constrained
    chemical_used           VARCHAR(200)    NULL,

    -- ── VIEW LINKS — UP TO 3 MEDIA ATTACHMENTS ───────────────

    -- From document AC1.1:
    -- "View Links – must allow to upload up to 3 pictures, files
    --  or images for information purposes"
    -- Stored in separate table room_cleaning_sop_step_media
    -- (one row per attachment, max 3 enforced by application + constraint)

    -- ── STATUS — AUTHORIZATION REQUIREMENT ───────────────────

    -- From document: "Every ADD/UPDATE/DELETE CRUD operation must
    -- be authorized by another user with higher role"
    -- pending   = step added, waiting for authorization
    -- approved  = authorized by higher-role user — active in system
    -- rejected  = authorization denied
    -- archived  = step deactivated (soft delete with authorization)
    status                  VARCHAR(20)     NOT NULL DEFAULT 'pending'
                                CHECK (status IN (
                                    'pending',
                                    'approved',
                                    'rejected',
                                    'archived'
                                )),

    -- ── UNIQUE CONSTRAINT ────────────────────────────────────

    -- Only one step per step_number per cleaning type
    -- Prevents two "Step 2" entries under the same cleaning type
    CONSTRAINT uq_step_per_type
        UNIQUE (cleaning_type_id, step_number),

    -- ── AUDIT FIELDS ─────────────────────────────────────────

    -- Who created this step
    created_by              UUID            NULL
                                REFERENCES tenant_pharmacore.users(id)
                                ON DELETE SET NULL,

    -- Who last modified this step
    updated_by              UUID            NULL
                                REFERENCES tenant_pharmacore.users(id)
                                ON DELETE SET NULL,

    -- Who authorized (approved/rejected) this step
    -- Must be a different user with higher role (document requirement)
    authorized_by           UUID            NULL
                                REFERENCES tenant_pharmacore.users(id)
                                ON DELETE SET NULL,

    authorized_at           TIMESTAMPTZ     NULL,

    -- Authorization remarks — reason for approval or rejection
    authorization_remarks   TEXT            NULL,

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()

);

-- ── INDEXES ──────────────────────────────────────────────────

-- The most critical query (AC4):
-- "When cleaning type is selected, load all approved steps in order"
CREATE INDEX IF NOT EXISTS idx_rcs_steps_type_order
    ON room_cleaning_sop_steps (cleaning_type_id, step_number)
    WHERE status = 'approved';

-- Find all pending steps waiting for authorization
CREATE INDEX IF NOT EXISTS idx_rcs_steps_pending
    ON room_cleaning_sop_steps (status, created_at DESC)
    WHERE status = 'pending';

-- Steps by cleaning method — filter for reports
CREATE INDEX IF NOT EXISTS idx_rcs_steps_method
    ON room_cleaning_sop_steps (cleaning_method);

-- Steps by equipment sequence — filter before/after queries
CREATE INDEX IF NOT EXISTS idx_rcs_steps_equip_seq
    ON room_cleaning_sop_steps (equipment_cleaning_sequence);

-- ── COMMENTS ─────────────────────────────────────────────────

COMMENT ON TABLE room_cleaning_sop_steps IS
    'SOP step templates for room cleaning procedures. Steps are loaded dynamically when a cleaning type is selected during a cleaning event (AC4). Every CRUD action requires authorization by a higher-role user.';

COMMENT ON COLUMN room_cleaning_sop_steps.slid IS
    'Auto-generated S.No shown in UI. Application manages renumbering when steps are deleted (AC1/AC2).';

COMMENT ON COLUMN room_cleaning_sop_steps.cleaning_method IS
    'TypeA=Dry, TypeB=Wet, TypeC=Sanitization. From document field: Dry/Wet/San Cleaning Type.';

COMMENT ON COLUMN room_cleaning_sop_steps.equipment_cleaning_sequence IS
    'Before=run before equipment cleaning, After=run after, NA=independent. New field from AC1.1 not on existing screens.';

COMMENT ON COLUMN room_cleaning_sop_steps.status IS
    'pending=awaiting authorization, approved=active in system, rejected=denied, archived=soft-deleted. Every change must be authorized by higher-role user.';

COMMENT ON COLUMN room_cleaning_sop_steps.authorized_by IS
    'Must be a DIFFERENT user from created_by with a higher role. Application enforces this constraint.';


-- ============================================================
-- TABLE 3: room_cleaning_sop_step_media
-- Stores up to 3 pictures/files per SOP step
-- AC1.1: "View Links – must allow to upload up to 3 pictures,
--          files or images for information purposes"
-- ============================================================

CREATE TABLE IF NOT EXISTS room_cleaning_sop_step_media (

    id                      UUID            PRIMARY KEY
                                            DEFAULT gen_random_uuid(),

    -- Which SOP step this media belongs to
    -- CASCADE — if step is deleted, its media goes too
    sop_step_id             UUID            NOT NULL
                                REFERENCES room_cleaning_sop_steps(id)
                                ON DELETE CASCADE,

    -- Position 1, 2, or 3 — max 3 per step (AC1.1)
    -- Enforced by unique constraint + application check
    media_position          INT             NOT NULL
                                CHECK (media_position IN (1, 2, 3)),

    -- S3 URL of the uploaded file
    file_url                VARCHAR(500)    NOT NULL,

    -- Original filename as uploaded by the user
    -- e.g. "step2_mopping_procedure.jpg"
    file_name               VARCHAR(255)    NULL,

    -- MIME type of the file
    -- e.g. "image/jpeg", "image/png", "application/pdf"
    file_type               VARCHAR(100)    NULL,

    -- File size in bytes — for display and storage management
    file_size_bytes         INT             NULL,

    -- Optional caption for this picture
    -- e.g. "Correct mopping direction — always left to right"
    caption                 TEXT            NULL,

    -- Who uploaded this file
    uploaded_by             UUID            NULL
                                REFERENCES tenant_pharmacore.users(id)
                                ON DELETE SET NULL,

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Enforce max 3 media per step, each position unique
    CONSTRAINT uq_step_media_position
        UNIQUE (sop_step_id, media_position)

);

-- ── INDEXES ──────────────────────────────────────────────────

-- Get all media for a step — used when rendering step detail
CREATE INDEX IF NOT EXISTS idx_rcs_step_media_step
    ON room_cleaning_sop_step_media (sop_step_id, media_position);

COMMENT ON TABLE room_cleaning_sop_step_media IS
    'Up to 3 pictures, files, or images per SOP step. AC1.1: View Links requirement. Unique constraint enforces max 3 per step.';

COMMENT ON COLUMN room_cleaning_sop_step_media.media_position IS
    '1, 2, or 3. Maximum 3 attachments per step as per AC1.1. Enforced by unique constraint on (sop_step_id, media_position).';


-- ============================================================
-- TABLE 4: room_cleaning_sop_step_equipment
-- Links cleaning tools to SOP steps
-- Replaces the free-text "Equipment Used" column with proper FK
-- Uses same cleaning_sop_step_tools pattern already designed
-- ============================================================

CREATE TABLE IF NOT EXISTS room_cleaning_sop_step_equipment (

    id                      UUID            PRIMARY KEY
                                            DEFAULT gen_random_uuid(),

    -- Which SOP step uses this tool
    sop_step_id             UUID            NOT NULL
                                REFERENCES room_cleaning_sop_steps(id)
                                ON DELETE CASCADE,

    -- Which cleaning tool from the master list
    -- FK to cleaning_equipment table designed earlier
    cleaning_equipment_id   UUID            NOT NULL
                                REFERENCES cleaning_equipment(id)
                                ON DELETE RESTRICT,

    -- Who linked this tool to this step
    created_by              UUID            NULL
                                REFERENCES tenant_pharmacore.users(id)
                                ON DELETE SET NULL,

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Prevent same tool linked twice to same step
    CONSTRAINT uq_step_equipment
        UNIQUE (sop_step_id, cleaning_equipment_id)

);

-- Get all tools for a step — used when rendering step
CREATE INDEX IF NOT EXISTS idx_rcs_step_equip_step
    ON room_cleaning_sop_step_equipment (sop_step_id);

-- Find all steps using a specific tool — impact analysis
CREATE INDEX IF NOT EXISTS idx_rcs_step_equip_tool
    ON room_cleaning_sop_step_equipment (cleaning_equipment_id);

COMMENT ON TABLE room_cleaning_sop_step_equipment IS
    'Links cleaning tools (from cleaning_equipment master) to SOP steps. Normalised replacement for free-text Equipment Used column.';


-- ============================================================
-- TABLE 5: room_cleaning_sop_step_audit
-- Full audit trail of every ADD/UPDATE/DELETE on SOP steps
-- Document requirement: "Audit and Reporting are must for every action"
-- Document requirement: "Every CRUD must be authorized by higher role"
-- ============================================================

CREATE TABLE IF NOT EXISTS room_cleaning_sop_step_audit (

    -- BIGSERIAL — sequential proves no audit records deleted
    id                      BIGSERIAL       PRIMARY KEY,

    -- Which SOP step this audit record is for
    -- SET NULL — if step is deleted, audit record is preserved
    sop_step_id             UUID            NULL
                                REFERENCES room_cleaning_sop_steps(id)
                                ON DELETE SET NULL,

    -- The cleaning type code at time of action — preserved even
    -- if cleaning type is later renamed or deleted
    cleaning_type_snapshot  VARCHAR(150)    NULL,

    -- What CRUD action was performed
    action                  VARCHAR(20)     NOT NULL
                                CHECK (action IN (
                                    'CREATE',
                                    'UPDATE',
                                    'DELETE',
                                    'APPROVE',
                                    'REJECT',
                                    'ARCHIVE'
                                )),

    -- Complete snapshot of the step data BEFORE this action
    -- NULL for CREATE (no previous state)
    -- Stored as JSONB — captures all column values at that moment
    before_state            JSONB           NULL,

    -- Complete snapshot of the step data AFTER this action
    -- NULL for DELETE/ARCHIVE (no new state)
    after_state             JSONB           NULL,

    -- Specific fields that changed (for UPDATE actions)
    -- e.g. ["step_number", "procedure_text"]
    changed_fields          TEXT[]          NULL,

    -- ── WHO DID WHAT ─────────────────────────────────────────

    -- Who performed the action (the initiating user)
    performed_by            UUID            NULL
                                REFERENCES tenant_pharmacore.users(id)
                                ON DELETE SET NULL,

    performed_by_username   VARCHAR(100)    NULL,   -- snapshot at time of action
    performed_by_role       VARCHAR(100)    NULL,   -- snapshot at time of action

    -- Who authorized this action (the approving user)
    -- Must be different from performed_by with higher role
    authorized_by           UUID            NULL
                                REFERENCES tenant_pharmacore.users(id)
                                ON DELETE SET NULL,

    authorized_by_username  VARCHAR(100)    NULL,   -- snapshot
    authorized_by_role      VARCHAR(100)    NULL,   -- snapshot

    -- Authorization status for this specific action
    authorization_status    VARCHAR(20)     NULL
                                CHECK (authorization_status IN (
                                    'pending',
                                    'approved',
                                    'rejected'
                                )),

    -- Reason for the action or authorization decision
    remarks                 TEXT            NULL,

    -- IP address and device of the person who performed the action
    ip_address              INET            NULL,
    user_agent              TEXT            NULL,

    -- When this audit record was created
    -- Append-only — no updated_at
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()

);

-- ── INDEXES ──────────────────────────────────────────────────

-- Audit history for one step — step detail screen
CREATE INDEX IF NOT EXISTS idx_rcs_audit_step
    ON room_cleaning_sop_step_audit (sop_step_id, created_at DESC);

-- All actions by one user — user activity report
CREATE INDEX IF NOT EXISTS idx_rcs_audit_performer
    ON room_cleaning_sop_step_audit (performed_by, created_at DESC);

-- All pending authorization requests
CREATE INDEX IF NOT EXISTS idx_rcs_audit_pending
    ON room_cleaning_sop_step_audit (authorization_status, created_at DESC)
    WHERE authorization_status = 'pending';

-- Date range audit queries — regulatory reporting
CREATE INDEX IF NOT EXISTS idx_rcs_audit_date
    ON room_cleaning_sop_step_audit (created_at DESC);

-- Filter by action type
CREATE INDEX IF NOT EXISTS idx_rcs_audit_action
    ON room_cleaning_sop_step_audit (action, created_at DESC);

COMMENT ON TABLE room_cleaning_sop_step_audit IS
    'Complete audit trail of all ADD/UPDATE/DELETE actions on SOP steps. Append-only. Every action records who performed it and who authorized it. GMP and document requirement.';

COMMENT ON COLUMN room_cleaning_sop_step_audit.before_state IS
    'JSONB snapshot of the step before this action. NULL for CREATE. Preserved even if step is later deleted.';

COMMENT ON COLUMN room_cleaning_sop_step_audit.performed_by_username IS
    'Username snapshot at time of action. Preserved even if user record is later modified.';


-- ── AUTO-UPDATE TRIGGERS ──────────────────────────────────────

-- CREATE OR REPLACE TRIGGER trg_room_cleaning_types_updated_at
--     BEFORE UPDATE ON room_cleaning_types
--     FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- CREATE OR REPLACE TRIGGER trg_room_cleaning_sop_steps_updated_at
--     BEFORE UPDATE ON room_cleaning_sop_steps
--     FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SEED DATA — Room Cleaning Types
-- Standard cleaning types used in pharmaceutical facilities
-- Matches the "Cleaning Type" values seen in your screens
-- ============================================================

INSERT INTO room_cleaning_types (
    cleaning_type_code, cleaning_type_name,
    cleaning_type_details, default_method,
    display_order, is_active
) VALUES

    (
        'RCT-001', 'Area Cleaning',
        'General area cleaning of room surfaces including floors, walls, and worktops using dry and wet methods.',
        'TypeB', 1, TRUE
    ),
    (
        'RCT-002', 'Deep Cleaning',
        'Thorough cleaning of all room surfaces including hard-to-reach areas. Performed periodically or after major production runs.',
        'TypeB', 2, TRUE
    ),
    (
        'RCT-003', 'Sanitization',
        'Application of approved disinfectant to all room surfaces to eliminate microbial contamination.',
        'TypeC', 3, TRUE
    ),
    (
        'RCT-004', 'CIP Cleaning',
        'Clean-In-Place procedure for rooms with fixed equipment that cannot be removed for cleaning.',
        'TypeB', 4, TRUE
    ),
    (
        'RCT-005', 'Change Over Cleaning',
        'Cleaning performed between production of different products to prevent cross-contamination.',
        'TypeB', 5, TRUE
    ),
    (
        'RCT-006', 'Shutdown Cleaning',
        'Comprehensive cleaning performed when a room is taken out of production for maintenance or extended shutdown.',
        'TypeB', 6, TRUE
    )

ON CONFLICT (cleaning_type_code) DO NOTHING;


-- ============================================================
-- SEED DATA — SOP Steps
-- Sample approved steps matching your Room Cleaning SOP screen
-- (image 14) — Area Cleaning type, 5 steps
-- ============================================================

INSERT INTO room_cleaning_sop_steps (
    slid, cleaning_type_id,
    step_number, time_allotted, time_allotted_display,
    cleaning_method, equipment_cleaning_sequence,
    procedure_text, chemical_used,
    status
) VALUES

    -- Area Cleaning — Step 1
    (
        1,
        (SELECT id FROM room_cleaning_types WHERE cleaning_type_code = 'RCT-001'),
        1, '00:05'::INTERVAL, '00:05',
        'TypeB', 'Before',
        'Remove loose material and dust from all surfaces using hand brush and dust pan. Sweep floor in one direction only.',
        'NA',
        'approved'
    ),

    -- Area Cleaning — Step 2
    (
        2,
        (SELECT id FROM room_cleaning_types WHERE cleaning_type_code = 'RCT-001'),
        2, '00:10'::INTERVAL, '00:10',
        'TypeB', 'Before',
        'Apply detergent solution to floor surface using mop. Ensure complete coverage of floor area.',
        'Detergent Solution',
        'approved'
    ),

    -- Area Cleaning — Step 3
    (
        3,
        (SELECT id FROM room_cleaning_types WHERE cleaning_type_code = 'RCT-001'),
        3, '00:10'::INTERVAL, '00:10',
        'TypeB', 'Before',
        'Scrub all surfaces thoroughly with scrub brush. Pay attention to corners and wall-floor junctions.',
        'Detergent Solution',
        'approved'
    ),

    -- Area Cleaning — Step 4
    (
        4,
        (SELECT id FROM room_cleaning_types WHERE cleaning_type_code = 'RCT-001'),
        4, '00:05'::INTERVAL, '00:05',
        'TypeB', 'After',
        'Rinse with clean water using mop. Remove all detergent residue from floor.',
        'NA',
        'approved'
    ),

    -- Area Cleaning — Step 5
    (
        5,
        (SELECT id FROM room_cleaning_types WHERE cleaning_type_code = 'RCT-001'),
        5, '00:05'::INTERVAL, '00:05',
        'TypeC', 'After',
        'Sanitize the area as per instruction using approved disinfectant. Apply using spray pump and allow contact time as specified.',
        'Disinfectant Solution',
        'approved'
    )

ON CONFLICT (cleaning_type_id, step_number) DO NOTHING;


-- Link tools to the seeded steps
INSERT INTO room_cleaning_sop_step_equipment (sop_step_id, cleaning_equipment_id)
SELECT
    s.id,
    ce.id
FROM room_cleaning_sop_steps s
CROSS JOIN cleaning_equipment ce
WHERE s.cleaning_type_id = (
        SELECT id FROM room_cleaning_types WHERE cleaning_type_code = 'RCT-001')
  AND s.step_number = 1
  AND ce.equipment_name IN ('Hand Brush', 'Dust Pan')
ON CONFLICT (sop_step_id, cleaning_equipment_id) DO NOTHING;

INSERT INTO room_cleaning_sop_step_equipment (sop_step_id, cleaning_equipment_id)
SELECT s.id, ce.id
FROM room_cleaning_sop_steps s
CROSS JOIN cleaning_equipment ce
WHERE s.cleaning_type_id = (
        SELECT id FROM room_cleaning_types WHERE cleaning_type_code = 'RCT-001')
  AND s.step_number = 2
  AND ce.equipment_name IN ('Bucket', 'Mop')
ON CONFLICT (sop_step_id, cleaning_equipment_id) DO NOTHING;

INSERT INTO room_cleaning_sop_step_equipment (sop_step_id, cleaning_equipment_id)
SELECT s.id, ce.id
FROM room_cleaning_sop_steps s
CROSS JOIN cleaning_equipment ce
WHERE s.cleaning_type_id = (
        SELECT id FROM room_cleaning_types WHERE cleaning_type_code = 'RCT-001')
  AND s.step_number = 3
  AND ce.equipment_name IN ('Scrub Brush')
ON CONFLICT (sop_step_id, cleaning_equipment_id) DO NOTHING;

INSERT INTO room_cleaning_sop_step_equipment (sop_step_id, cleaning_equipment_id)
SELECT s.id, ce.id
FROM room_cleaning_sop_steps s
CROSS JOIN cleaning_equipment ce
WHERE s.cleaning_type_id = (
        SELECT id FROM room_cleaning_types WHERE cleaning_type_code = 'RCT-001')
  AND s.step_number = 4
  AND ce.equipment_name IN ('Bucket', 'Mop')
ON CONFLICT (sop_step_id, cleaning_equipment_id) DO NOTHING;

INSERT INTO room_cleaning_sop_step_equipment (sop_step_id, cleaning_equipment_id)
SELECT s.id, ce.id
FROM room_cleaning_sop_steps s
CROSS JOIN cleaning_equipment ce
WHERE s.cleaning_type_id = (
        SELECT id FROM room_cleaning_types WHERE cleaning_type_code = 'RCT-001')
  AND s.step_number = 5
  AND ce.equipment_name IN ('Spray Pump', 'Microfiber Cloth')
ON CONFLICT (sop_step_id, cleaning_equipment_id) DO NOTHING;


-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Full SOP step list matching your screen (image 14)
SELECT
    s.slid                              AS "S.No",
    ct.cleaning_type_name               AS "Cleaning Type",
    s.step_number                       AS "Step No.",
    s.time_allotted_display             AS "Time Allotted",
    CASE s.cleaning_method
        WHEN 'TypeA' THEN 'Dry'
        WHEN 'TypeB' THEN 'Wet'
        WHEN 'TypeC' THEN 'San'
    END                                 AS "Dry/Wet/San",
    s.equipment_cleaning_sequence       AS "Before/After Equ.",
    s.procedure_text                    AS "Procedure",
    s.chemical_used                     AS "Chemical Used",
    STRING_AGG(ce.equipment_name, ', '
        ORDER BY ce.display_order)      AS "Equipment Used",
    s.status                            AS "Status"
FROM room_cleaning_sop_steps s
JOIN room_cleaning_types ct ON ct.id = s.cleaning_type_id
LEFT JOIN room_cleaning_sop_step_equipment rse ON rse.sop_step_id = s.id
LEFT JOIN cleaning_equipment ce ON ce.id = rse.cleaning_equipment_id
GROUP BY s.slid, ct.cleaning_type_name, s.step_number,
         s.time_allotted_display, s.cleaning_method,
         s.equipment_cleaning_sequence, s.procedure_text,
         s.chemical_used, s.status
ORDER BY ct.cleaning_type_name, s.step_number;

-- AC4 query — load all approved steps for a cleaning type in order
-- This is what runs when operator selects "Area Cleaning"
SELECT
    s.step_number,
    s.time_allotted_display,
    s.cleaning_method,
    s.equipment_cleaning_sequence,
    s.procedure_text,
    s.chemical_used,
    STRING_AGG(ce.equipment_name, ', ' ORDER BY ce.display_order) AS equipment_used
FROM room_cleaning_sop_steps s
LEFT JOIN room_cleaning_sop_step_equipment rse ON rse.sop_step_id = s.id
LEFT JOIN cleaning_equipment ce ON ce.id = rse.cleaning_equipment_id
WHERE s.cleaning_type_id = (
    SELECT id FROM room_cleaning_types WHERE cleaning_type_name = 'Area Cleaning')
  AND s.status = 'approved'
GROUP BY s.step_number, s.time_allotted_display, s.cleaning_method,
         s.equipment_cleaning_sequence, s.procedure_text, s.chemical_used
ORDER BY s.step_number;

-- Pending authorization queue — for supervisors
SELECT
    ct.cleaning_type_name               AS "Cleaning Type",
    s.step_number                       AS "Step No.",
    s.procedure_text                    AS "Procedure",
    s.status                            AS "Status",
    s.created_at                        AS "Submitted At"
FROM room_cleaning_sop_steps s
JOIN room_cleaning_types ct ON ct.id = s.cleaning_type_id
WHERE s.status = 'pending'
ORDER BY s.created_at;

-- Summary
SELECT 'room_cleaning_types' AS "Table", COUNT(*) AS "Rows"
FROM room_cleaning_types
UNION ALL
SELECT 'room_cleaning_sop_steps', COUNT(*) FROM room_cleaning_sop_steps
UNION ALL
SELECT 'room_cleaning_sop_step_equipment', COUNT(*) FROM room_cleaning_sop_step_equipment
UNION ALL
SELECT 'room_cleaning_sop_step_media', COUNT(*) FROM room_cleaning_sop_step_media
UNION ALL
SELECT 'room_cleaning_sop_step_audit', COUNT(*) FROM room_cleaning_sop_step_audit;

-- ============================================================
-- END OF FILE
-- ============================================================