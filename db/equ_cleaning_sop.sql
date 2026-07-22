-- ============================================================
-- DIGILOG — Equipment Cleaning SOP Steps Module
-- User Story: 016 - Equipment Cleaning SOP Steps
--
-- Columns: S.No, Cleaning Type, Step No., Time Allotted,
--          Dry/Wet/San, Procedure, Chemical Used,
--          Equipment Used, View Links (up to 3 pictures)
-- ============================================================
SET search_path TO tenant_pharmacore;

-- ── TABLE 1: equ_cleaning_sop_steps ──────────────────────────

CREATE TABLE IF NOT EXISTS equ_cleaning_sop_steps (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    -- S.No — auto-generated, auto-adjusted on delete
    slid                    INT             NOT NULL,

    -- Cleaning Type FK (same room_cleaning_types table)
    cleaning_type_id        UUID            NOT NULL
                                REFERENCES room_cleaning_types(id) ON DELETE RESTRICT,

    -- Step No.
    step_number             INT             NOT NULL,

    -- Time Allotted (display string e.g. "00:05")
    time_allotted_display   VARCHAR(10)     NULL,

    -- Dry/Wet/San — TypeA=Dry, TypeB=Wet, TypeC=Sanitization
    cleaning_method         VARCHAR(10)     NOT NULL
                                CHECK (cleaning_method IN ('TypeA', 'TypeB', 'TypeC')),

    -- Procedure text
    procedure_text          TEXT            NOT NULL,

    -- Chemical Used
    chemical_used           VARCHAR(200)    NULL,

    -- Equipment Used (e.g. "Mop", "Brush", "Lint-free wipe")
    equipment_used          VARCHAR(300)    NULL,

    -- Status
    status                  VARCHAR(20)     NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','approved','rejected','archived')),

    CONSTRAINT uq_equ_sop_step_per_type UNIQUE (cleaning_type_id, step_number),

    -- Authorization
    authorized_by           UUID            NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    authorized_at           TIMESTAMPTZ     NULL,
    authorization_remarks   TEXT            NULL,

    -- Audit
    created_by              UUID            NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    updated_by              UUID            NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equ_sop_steps_type_order ON equ_cleaning_sop_steps (cleaning_type_id, step_number) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_equ_sop_steps_pending     ON equ_cleaning_sop_steps (status, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_equ_sop_steps_type        ON equ_cleaning_sop_steps (cleaning_type_id);
CREATE INDEX IF NOT EXISTS idx_equ_sop_steps_slid        ON equ_cleaning_sop_steps (slid);

COMMENT ON TABLE equ_cleaning_sop_steps IS
    'Equipment Cleaning SOP step templates. Steps are loaded dynamically when a cleaning type is selected for an equipment cleaning process (AC4).';

-- ── TABLE 2: equ_cleaning_sop_step_media ─────────────────────
-- Up to 3 pictures/files per step (AC1.1 "View Links")

CREATE TABLE IF NOT EXISTS equ_cleaning_sop_step_media (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sop_step_id     UUID        NOT NULL REFERENCES equ_cleaning_sop_steps(id) ON DELETE CASCADE,

    -- Display order 1–3 (application enforces max 3)
    display_order   INT         NOT NULL DEFAULT 1,

    file_url        VARCHAR(500) NOT NULL,
    file_name       VARCHAR(255) NULL,
    file_type       VARCHAR(100) NULL,
    caption         TEXT        NULL,

    uploaded_by     UUID        NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equ_sop_media_step  ON equ_cleaning_sop_step_media (sop_step_id, display_order);
CREATE INDEX IF NOT EXISTS idx_equ_sop_media_count ON equ_cleaning_sop_step_media (sop_step_id);

COMMENT ON TABLE equ_cleaning_sop_step_media IS
    'Reference pictures/files for each Equipment Cleaning SOP step. Maximum 3 per step (AC1.1 View Links).';

-- ── TABLE 3: equ_cleaning_sop_step_audit ─────────────────────

CREATE TABLE IF NOT EXISTS equ_cleaning_sop_step_audit (
    id                      BIGSERIAL   PRIMARY KEY,
    sop_step_id             UUID        NULL REFERENCES equ_cleaning_sop_steps(id) ON DELETE SET NULL,
    cleaning_type_snapshot  VARCHAR(150) NULL,
    action                  VARCHAR(20) NOT NULL CHECK (action IN ('CREATE','UPDATE','DELETE','APPROVE','REJECT','ARCHIVE')),
    before_state            JSONB       NULL,
    after_state             JSONB       NULL,
    changed_fields          TEXT[]      NULL,
    performed_by            UUID        NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    performed_by_username   VARCHAR(100) NULL,
    performed_by_role       VARCHAR(100) NULL,
    authorized_by           UUID        NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    authorized_by_username  VARCHAR(100) NULL,
    authorized_by_role      VARCHAR(100) NULL,
    authorization_status    VARCHAR(20) NULL CHECK (authorization_status IN ('pending','approved','rejected')),
    remarks                 TEXT        NULL,
    ip_address              INET        NULL,
    user_agent              TEXT        NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equ_sop_audit_step   ON equ_cleaning_sop_step_audit (sop_step_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_equ_sop_audit_action ON equ_cleaning_sop_step_audit (action, created_at DESC);
