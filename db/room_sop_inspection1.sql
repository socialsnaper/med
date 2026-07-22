-- ============================================================
-- DIGILOG — Room Inspection1 SOP Steps Module
-- PostgreSQL 15+
--
-- SOURCE: User Story document
--         "013 - User Story - Room Cleaning Inspection1 SOP Steps.docx"
--
-- WHAT THIS FILE CONTAINS:
--   TABLE 1 : room_inspection1_sop_steps
--             SOP step templates for the 1st inspection process
--             performed AFTER room cleaning is completed (AC4)
--             One row = one inspection step per cleaning type
--
--   TABLE 2 : room_inspection1_sop_step_media
--             Pictures/files attached to each inspection step
--             AC1.1: "at least 1 picture" per step
--             No stated maximum — application enforces minimum 1
--
--   TABLE 3 : room_inspection1_sop_step_audit
--             Full audit trail of every ADD/UPDATE/DELETE
--             Document: "Audit and Reporting are must for every action"
--             Document: "Every CRUD must be authorized by higher role"
--
-- ============================================================
-- COMPARISON WITH ROOM CLEANING SOP (doc 012)
-- ============================================================
--
-- Room Cleaning SOP has 10 columns:
--   S.No, Cleaning Type, Step No., Time Allotted,
--   Dry/Wet/San, Before/After Equipment, Procedure,
--   Chemical Used, Equipment Used, View Links (max 3)
--
-- Room Inspection1 SOP has only 4 columns (AC1.1):
--   S.No, Cleaning Type, Procedure, Step No., Picture (min 1)
--
-- WHAT IS INTENTIONALLY ABSENT in Inspection1:
--   → No Time Allotted  — inspection has no fixed time
--   → No Dry/Wet/San    — inspection is visual, not wet/dry
--   → No Before/After Equipment — inspection happens after cleaning
--   → No Chemical Used  — no chemicals in inspection
--   → No Equipment Used — no cleaning tools in inspection
--
-- WHAT IS DIFFERENT about media:
--   Cleaning SOP: "up to 3 pictures/files" (max 3, any type)
--   Inspection1:  "at least 1 picture"     (min 1, no max stated)
--   Inspection pictures show WHAT TO LOOK FOR during inspection
--   e.g. "room should look like this after cleaning"
--
-- WHEN INSPECTION1 TRIGGERS (AC4):
--   "WHEN a room is done with cleaning as per the selected
--    Type of Cleaning, THEN all 1st inspection process steps
--    must be picked and displayed in a set sequence dynamically"
--   → Inspector 1 performs this check AFTER cleaning is complete
--   → Different from cleaning steps (done BY cleaner)
--   → Inspection1 is done BY a different person (first inspector)
--
-- SHARED WITH CLEANING SOP:
--   → room_cleaning_types table (same cleaning type FK)
--   → authorization workflow (pending → approved/rejected)
--   → audit trail pattern (BIGSERIAL, before/after JSONB)
--   → import/export requirement (AC5/AC6 — application layer)
--
-- DEPENDS ON:
--   users table              — audit and authorization FKs
--   room_cleaning_types      — created in digilog_room_cleaning_sop.sql
--                              MUST run that file first
-- ============================================================


-- ============================================================
-- TABLE 1: room_inspection1_sop_steps
-- SOP step templates for Inspector 1 to follow after
-- room cleaning is completed for a given cleaning type
-- ============================================================
SET search_path TO tenant_pharmacore;

CREATE TABLE IF NOT EXISTS room_inspection1_sop_steps (

    -- ── IDENTIFIERS ──────────────────────────────────────────

    id                      UUID            PRIMARY KEY
                                            DEFAULT gen_random_uuid(),

    -- S.No column — auto-generated, auto-adjusted on delete
    -- AC1: "S.No must be auto generated from the application"
    -- AC2: "S.No must be auto adjusted in the application"
    -- Scoped per cleaning type — restarts from 1 for each type
    slid                    INT             NOT NULL,

    -- ── CLEANING TYPE ─────────────────────────────────────────

    -- "Cleaning Type" column (AC1.1)
    -- FK to room_cleaning_types — same types used in cleaning SOP
    -- RESTRICT — cannot delete a cleaning type that has inspection steps
    -- e.g. "Area Cleaning", "Deep Cleaning", "Sanitization"
    cleaning_type_id        UUID            NOT NULL
                                REFERENCES room_cleaning_types(id)
                                ON DELETE RESTRICT,

    -- ── STEP ORDERING ─────────────────────────────────────────

    -- "Step No." column (AC1.1)
    -- Controls sequence inspectors follow during inspection
    -- Admin can reorder steps without deleting and re-creating
    step_number             INT             NOT NULL,

    -- ── PROCEDURE ─────────────────────────────────────────────

    -- "Procedure" column (AC1.1)
    -- Detailed description of what Inspector 1 must check
    -- e.g. "Check floor is clean and dry with no residue"
    -- e.g. "Verify walls are free from contamination"
    -- e.g. "Confirm all cleaning materials are removed from room"
    procedure_text          TEXT            NOT NULL,

    -- ── PICTURE — "at least 1" (AC1.1) ───────────────────────
    -- Stored in room_inspection1_sop_step_media table
    -- Application enforces minimum 1 on save
    -- No stated maximum in document — application can allow unlimited
    -- Media table has no position constraint unlike cleaning SOP
    -- which had max 3 enforced via position column

    -- ── STATUS — AUTHORIZATION REQUIREMENT ───────────────────

    -- Document: "Every ADD/UPDATE/DELETE CRUD operation must be
    -- authorized by another user with higher role"
    -- Same workflow as room_cleaning_sop_steps:
    --   pending  = submitted, awaiting authorization
    --   approved = authorized by higher-role user, active in system
    --   rejected = authorization denied, step not active
    --   archived = soft-deleted with authorization
    status                  VARCHAR(20)     NOT NULL DEFAULT 'pending'
                                CHECK (status IN (
                                    'pending',
                                    'approved',
                                    'rejected',
                                    'archived'
                                )),

    -- ── UNIQUE CONSTRAINT ─────────────────────────────────────

    -- Only one step per step_number per cleaning type
    -- Prevents duplicate step numbers under the same cleaning type
    CONSTRAINT uq_insp1_step_per_type
        UNIQUE (cleaning_type_id, step_number),

    -- ── AUDIT FIELDS ──────────────────────────────────────────

    -- Who created this step
    created_by              UUID            NULL
                                REFERENCES tenant_pharmacore.users(id)
                                ON DELETE SET NULL,

    -- Who last edited this step
    updated_by              UUID            NULL
                                REFERENCES tenant_pharmacore.users(id)
                                ON DELETE SET NULL,

    -- Who authorized (approved or rejected) this step
    -- Must be a DIFFERENT user from created_by with higher role
    -- Application enforces: authorized_by != created_by
    authorized_by           UUID            NULL
                                REFERENCES tenant_pharmacore.users(id)
                                ON DELETE SET NULL,

    authorized_at           TIMESTAMPTZ     NULL,

    -- Reason for approval or rejection
    authorization_remarks   TEXT            NULL,

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()

);

-- ── INDEXES ──────────────────────────────────────────────────

-- AC4 critical query — load all approved inspection steps in order
-- when Inspector 1 starts checking a cleaned room
-- "all 1st inspection process steps must be picked and displayed
--  in a set sequence dynamically" (AC4)
CREATE INDEX IF NOT EXISTS idx_insp1_steps_type_order
    ON room_inspection1_sop_steps (cleaning_type_id, step_number)
    WHERE status = 'approved';

-- Pending authorization queue — supervisor review screen
CREATE INDEX IF NOT EXISTS idx_insp1_steps_pending
    ON room_inspection1_sop_steps (status, created_at DESC)
    WHERE status = 'pending';

-- All steps for a cleaning type — admin management screen
CREATE INDEX IF NOT EXISTS idx_insp1_steps_type
    ON room_inspection1_sop_steps (cleaning_type_id);

-- SLID ordering for list screen display
CREATE INDEX IF NOT EXISTS idx_insp1_steps_slid
    ON room_inspection1_sop_steps (slid);

-- ── COMMENTS ──────────────────────────────────────────────────

COMMENT ON TABLE room_inspection1_sop_steps IS
    'SOP step templates for Inspector 1 to follow after room cleaning is completed. Steps are loaded dynamically when cleaning is done and a Type of Cleaning is selected (AC4). Requires authorization from a higher-role user for every CRUD action.';

COMMENT ON COLUMN room_inspection1_sop_steps.slid IS
    'Auto-generated S.No display number. Application renumbers on delete (AC1/AC2).';

COMMENT ON COLUMN room_inspection1_sop_steps.cleaning_type_id IS
    'Same room_cleaning_types FK used in room_cleaning_sop_steps. Inspection type matches the cleaning type used.';

COMMENT ON COLUMN room_inspection1_sop_steps.procedure_text IS
    'What Inspector 1 must check. e.g. "Verify floor is clean and dry with no detergent residue."';

COMMENT ON COLUMN room_inspection1_sop_steps.status IS
    'pending=awaiting auth, approved=active, rejected=denied, archived=soft-deleted. All changes need higher-role authorization.';

COMMENT ON COLUMN room_inspection1_sop_steps.authorized_by IS
    'Must be a different user from created_by with higher role. Application enforces authorized_by != created_by.';


-- ============================================================
-- TABLE 2: room_inspection1_sop_step_media
-- Pictures and files attached to each inspection step
--
-- KEY DIFFERENCE FROM CLEANING SOP MEDIA:
--   Cleaning SOP:  max 3, enforced by position column (1/2/3)
--   Inspection1:   min 1 required, no stated max in document
--   → No position column here (no max to enforce via positions)
--   → No unique position constraint
--   → Application enforces min 1 on step save/approve
--   → Sequence controlled by display_order column
--
-- WHAT THESE PICTURES ARE:
--   Reference pictures showing what a properly cleaned room
--   should look like. Inspector compares actual room against
--   these reference images during inspection.
--   e.g. "Floor should look like this — no residue, dry"
-- ============================================================

CREATE TABLE IF NOT EXISTS room_inspection1_sop_step_media (

    id                      UUID            PRIMARY KEY
                                            DEFAULT gen_random_uuid(),

    -- Which inspection step this media belongs to
    -- CASCADE — if step is deleted, its media is deleted too
    sop_step_id             UUID            NOT NULL
                                REFERENCES room_inspection1_sop_steps(id)
                                ON DELETE CASCADE,

    -- Display order when multiple pictures exist for one step
    -- Lower number shown first
    display_order           INT             NOT NULL DEFAULT 1,

    -- S3 URL of the uploaded picture or file
    file_url                VARCHAR(500)    NOT NULL,

    -- Original filename as uploaded
    -- e.g. "clean_floor_reference.jpg", "wall_check_guide.png"
    file_name               VARCHAR(255)    NULL,

    -- MIME type — primarily images for inspection steps
    -- e.g. "image/jpeg", "image/png", "image/webp", "application/pdf"
    file_type               VARCHAR(100)    NULL,

    -- File size in bytes
    file_size_bytes         INT             NULL,

    -- Caption describing what this picture shows
    -- e.g. "Floor after proper Area Cleaning — no visible residue"
    -- Helps inspector understand what standard they are checking against
    caption                 TEXT            NULL,

    -- Who uploaded this picture
    uploaded_by             UUID            NULL
                                REFERENCES tenant_pharmacore.users(id)
                                ON DELETE SET NULL,

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()

    -- No updated_at — media records are replaced not updated
    -- To change a picture: delete old record, insert new one

);

-- ── INDEXES ──────────────────────────────────────────────────

-- Get all media for a step in display order
-- Used when rendering inspection step with reference pictures
CREATE INDEX IF NOT EXISTS idx_insp1_step_media_step
    ON room_inspection1_sop_step_media (sop_step_id, display_order);

-- Count media per step — application uses this to enforce min 1
CREATE INDEX IF NOT EXISTS idx_insp1_step_media_count
    ON room_inspection1_sop_step_media (sop_step_id);

COMMENT ON TABLE room_inspection1_sop_step_media IS
    'Reference pictures for each Inspection1 SOP step. AC1.1 requires at least 1 picture per step — enforced by application on save. No maximum stated in document.';

COMMENT ON COLUMN room_inspection1_sop_step_media.display_order IS
    'Controls picture order when multiple images exist for one step. Unlike cleaning SOP, no max enforced at DB level — application enforces min 1.';

COMMENT ON COLUMN room_inspection1_sop_step_media.caption IS
    'Describes what the reference picture shows. Helps inspector compare actual room condition against the expected standard.';


-- ============================================================
-- TABLE 3: room_inspection1_sop_step_audit
-- Full audit trail — identical pattern to cleaning SOP audit
-- Document: "Audit and Reporting are must for every action"
-- Document: "Every CRUD must be authorized by higher role"
-- ============================================================

CREATE TABLE IF NOT EXISTS room_inspection1_sop_step_audit (

    -- BIGSERIAL — sequential order proves no records deleted
    id                      BIGSERIAL       PRIMARY KEY,

    -- Which inspection step this audit record is for
    -- SET NULL — audit record preserved even if step is deleted
    sop_step_id             UUID            NULL
                                REFERENCES room_inspection1_sop_steps(id)
                                ON DELETE SET NULL,

    -- Cleaning type name snapshot — preserved even if type renamed
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

    -- State of the step BEFORE this action (NULL for CREATE)
    before_state            JSONB           NULL,

    -- State of the step AFTER this action (NULL for DELETE/ARCHIVE)
    after_state             JSONB           NULL,

    -- Specific columns that changed (for UPDATE actions)
    -- e.g. ["step_number", "procedure_text"]
    changed_fields          TEXT[]          NULL,

    -- ── WHO PERFORMED THE ACTION ──────────────────────────────

    performed_by            UUID            NULL
                                REFERENCES tenant_pharmacore.users(id)
                                ON DELETE SET NULL,

    -- Snapshots preserved even if user record is modified later
    performed_by_username   VARCHAR(100)    NULL,
    performed_by_role       VARCHAR(100)    NULL,

    -- ── WHO AUTHORIZED THE ACTION ─────────────────────────────

    -- Must be a different user from performed_by with higher role
    authorized_by           UUID            NULL
                                REFERENCES tenant_pharmacore.users(id)
                                ON DELETE SET NULL,

    authorized_by_username  VARCHAR(100)    NULL,
    authorized_by_role      VARCHAR(100)    NULL,

    authorization_status    VARCHAR(20)     NULL
                                CHECK (authorization_status IN (
                                    'pending',
                                    'approved',
                                    'rejected'
                                )),

    -- Reason for action or authorization decision
    remarks                 TEXT            NULL,

    -- Device details of the user who performed the action
    ip_address              INET            NULL,
    user_agent              TEXT            NULL,

    -- Append-only — no updated_at
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()

);

-- ── INDEXES ──────────────────────────────────────────────────

-- Audit history for one step — step detail screen
CREATE INDEX IF NOT EXISTS idx_insp1_audit_step
    ON room_inspection1_sop_step_audit (sop_step_id, created_at DESC);

-- All pending authorization requests — supervisor queue
CREATE INDEX IF NOT EXISTS idx_insp1_audit_pending
    ON room_inspection1_sop_step_audit (authorization_status, created_at DESC)
    WHERE authorization_status = 'pending';

-- All actions by a specific user — activity report
CREATE INDEX IF NOT EXISTS idx_insp1_audit_performer
    ON room_inspection1_sop_step_audit (performed_by, created_at DESC);

-- Date range queries — regulatory audit
CREATE INDEX IF NOT EXISTS idx_insp1_audit_date
    ON room_inspection1_sop_step_audit (created_at DESC);

-- Filter by action type
CREATE INDEX IF NOT EXISTS idx_insp1_audit_action
    ON room_inspection1_sop_step_audit (action, created_at DESC);

COMMENT ON TABLE room_inspection1_sop_step_audit IS
    'Append-only audit trail for Inspection1 SOP step CRUD actions. Same pattern as room_cleaning_sop_step_audit. Every action records performer and authorizer.';


-- ── AUTO-UPDATE TRIGGER ───────────────────────────────────────

-- CREATE OR REPLACE TRIGGER trg_insp1_sop_steps_updated_at
--     BEFORE UPDATE ON room_inspection1_sop_steps
--     FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SEED DATA — Inspection1 SOP Steps
-- 5 sample inspection steps for "Area Cleaning" type
-- Matches Room Inspection SOP screen (image 12) in your screenshots
-- ============================================================

INSERT INTO room_inspection1_sop_steps (
    slid,
    cleaning_type_id,
    step_number,
    procedure_text,
    status
) VALUES

    (
        1,
        (SELECT id FROM room_cleaning_types WHERE cleaning_type_code = 'RCT-001'),
        1,
        'Remove loose dust and visible soil from walls. Inspect all wall surfaces from top to bottom for any dust, stains, or contamination marks.',
        'approved'
    ),
    (
        2,
        (SELECT id FROM room_cleaning_types WHERE cleaning_type_code = 'RCT-001'),
        2,
        'Clean the walls using approved detergent. Verify walls are wiped with clean cloth and no detergent residue or streaks remain on wall surface.',
        'approved'
    ),
    (
        3,
        (SELECT id FROM room_cleaning_types WHERE cleaning_type_code = 'RCT-001'),
        3,
        'Wipe doors, windows and handles. Check all door handles, window frames and ledges are free from dust, residue and contamination.',
        'approved'
    ),
    (
        4,
        (SELECT id FROM room_cleaning_types WHERE cleaning_type_code = 'RCT-001'),
        4,
        'Sanitize the floor using approved disinfectant. Verify floor is clean, dry and uniform in appearance with no visible residue or wet patches.',
        'approved'
    ),
    (
        5,
        (SELECT id FROM room_cleaning_types WHERE cleaning_type_code = 'RCT-001'),
        5,
        'Allow the area to dry completely before inspection sign-off. Confirm no cleaning materials or equipment are left in the room.',
        'approved'
    )

ON CONFLICT (cleaning_type_id, step_number) DO NOTHING;


-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Full step list matching your Room Inspection SOP screen (image 12)
SELECT
    s.slid                          AS "S.No",
    ct.cleaning_type_name           AS "Cleaning Type",
    s.procedure_text                AS "Procedure",
    s.step_number                   AS "Step No.",
    COUNT(m.id)                     AS "Picture Count",
    s.status                        AS "Status"
FROM room_inspection1_sop_steps s
JOIN room_cleaning_types ct ON ct.id = s.cleaning_type_id
LEFT JOIN room_inspection1_sop_step_media m ON m.sop_step_id = s.id
GROUP BY s.slid, ct.cleaning_type_name, s.procedure_text,
         s.step_number, s.status
ORDER BY ct.cleaning_type_name, s.step_number;

-- AC4 query — load approved Inspection1 steps after cleaning is done
-- Called when Inspector 1 opens the inspection checklist
SELECT
    s.step_number           AS "Step",
    s.procedure_text        AS "What to Check",
    COUNT(m.id)             AS "Reference Pictures"
FROM room_inspection1_sop_steps s
LEFT JOIN room_inspection1_sop_step_media m ON m.sop_step_id = s.id
WHERE s.cleaning_type_id = (
    SELECT id FROM room_cleaning_types
    WHERE cleaning_type_name = 'Area Cleaning')
  AND s.status = 'approved'
GROUP BY s.step_number, s.procedure_text
ORDER BY s.step_number;

-- Steps missing required picture (min 1) — data quality check
SELECT
    ct.cleaning_type_name           AS "Cleaning Type",
    s.step_number                   AS "Step No.",
    s.procedure_text                AS "Procedure",
    s.status                        AS "Status"
FROM room_inspection1_sop_steps s
JOIN room_cleaning_types ct ON ct.id = s.cleaning_type_id
LEFT JOIN room_inspection1_sop_step_media m ON m.sop_step_id = s.id
WHERE m.id IS NULL
ORDER BY ct.cleaning_type_name, s.step_number;

-- Pending authorization queue for supervisors
SELECT
    ct.cleaning_type_name           AS "Cleaning Type",
    s.step_number                   AS "Step No.",
    LEFT(s.procedure_text, 60)      AS "Procedure (preview)",
    s.status                        AS "Status",
    s.created_at                    AS "Submitted At"
FROM room_inspection1_sop_steps s
JOIN room_cleaning_types ct ON ct.id = s.cleaning_type_id
WHERE s.status = 'pending'
ORDER BY s.created_at;

-- Summary
SELECT 'room_inspection1_sop_steps' AS "Table", COUNT(*) AS "Rows"
FROM room_inspection1_sop_steps
UNION ALL
SELECT 'room_inspection1_sop_step_media', COUNT(*)
FROM room_inspection1_sop_step_media
UNION ALL
SELECT 'room_inspection1_sop_step_audit', COUNT(*)
FROM room_inspection1_sop_step_audit;

-- ============================================================
-- END OF FILE
-- ============================================================