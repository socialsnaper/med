-- ============================================================
-- DIGILOG — Room Inspection2 SOP Steps Module
-- Mirrors inspection1 exactly; performed by the 2nd inspector.
-- ============================================================
SET search_path TO tenant_pharmacore;

-- ── TABLE 1: room_inspection2_sop_steps ──────────────────────

CREATE TABLE IF NOT EXISTS room_inspection2_sop_steps (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    slid                    INT             NOT NULL,
    cleaning_type_id        UUID            NOT NULL
                                REFERENCES room_cleaning_types(id) ON DELETE RESTRICT,
    step_number             INT             NOT NULL,
    procedure_text          TEXT            NOT NULL,
    status                  VARCHAR(20)     NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','approved','rejected','archived')),
    CONSTRAINT uq_insp2_step_per_type UNIQUE (cleaning_type_id, step_number),
    authorized_by           UUID            NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    authorized_at           TIMESTAMPTZ     NULL,
    authorization_remarks   TEXT            NULL,
    created_by              UUID            NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    updated_by              UUID            NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insp2_steps_type_order ON room_inspection2_sop_steps (cleaning_type_id, step_number) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_insp2_steps_pending     ON room_inspection2_sop_steps (status, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_insp2_steps_type        ON room_inspection2_sop_steps (cleaning_type_id);
CREATE INDEX IF NOT EXISTS idx_insp2_steps_slid        ON room_inspection2_sop_steps (slid);

COMMENT ON TABLE room_inspection2_sop_steps IS
    'SOP step templates for Inspector 2 — the second verification pass after room cleaning. Mirrors inspection1 structure exactly.';

-- ── TABLE 2: room_inspection2_sop_step_media ─────────────────

CREATE TABLE IF NOT EXISTS room_inspection2_sop_step_media (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sop_step_id     UUID        NOT NULL REFERENCES room_inspection2_sop_steps(id) ON DELETE CASCADE,
    display_order   INT         NOT NULL DEFAULT 1,
    file_url        VARCHAR(500) NOT NULL,
    file_name       VARCHAR(255) NULL,
    file_type       VARCHAR(100) NULL,
    caption         TEXT        NULL,
    uploaded_by     UUID        NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insp2_step_media_step  ON room_inspection2_sop_step_media (sop_step_id, display_order);
CREATE INDEX IF NOT EXISTS idx_insp2_step_media_count ON room_inspection2_sop_step_media (sop_step_id);

COMMENT ON TABLE room_inspection2_sop_step_media IS
    'Reference pictures for each Inspection2 SOP step. Minimum 1 picture required per step.';

-- ── TABLE 3: room_inspection2_sop_step_audit ─────────────────

CREATE TABLE IF NOT EXISTS room_inspection2_sop_step_audit (
    id                      BIGSERIAL   PRIMARY KEY,
    sop_step_id             UUID        NULL REFERENCES room_inspection2_sop_steps(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_insp2_audit_step   ON room_inspection2_sop_step_audit (sop_step_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insp2_audit_action ON room_inspection2_sop_step_audit (action, created_at DESC);
