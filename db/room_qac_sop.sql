-- ============================================================
-- DIGILOG — Room QAC (Quality Assurance Check) SOP Steps
-- QAC is a final quality verification after both inspections.
-- Same column structure as Inspection 1 / Inspection 2.
-- ============================================================
SET search_path TO tenant_pharmacore;

-- ── TABLE 1: room_qac_sop_steps ──────────────────────────────

CREATE TABLE IF NOT EXISTS room_qac_sop_steps (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    slid                    INT             NOT NULL,
    cleaning_type_id        UUID            NOT NULL
                                REFERENCES room_cleaning_types(id) ON DELETE RESTRICT,
    step_number             INT             NOT NULL,
    procedure_text          TEXT            NOT NULL,
    status                  VARCHAR(20)     NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','approved','rejected','archived')),
    CONSTRAINT uq_qac_step_per_type UNIQUE (cleaning_type_id, step_number),
    authorized_by           UUID            NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    authorized_at           TIMESTAMPTZ     NULL,
    authorization_remarks   TEXT            NULL,
    created_by              UUID            NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    updated_by              UUID            NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qac_steps_type_order ON room_qac_sop_steps (cleaning_type_id, step_number) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_qac_steps_pending     ON room_qac_sop_steps (status, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_qac_steps_type        ON room_qac_sop_steps (cleaning_type_id);
CREATE INDEX IF NOT EXISTS idx_qac_steps_slid        ON room_qac_sop_steps (slid);

COMMENT ON TABLE room_qac_sop_steps IS
    'SOP step templates for the Quality Assurance Check (QAC) — the final verification of room cleanliness performed by a QAC officer.';

-- ── TABLE 2: room_qac_sop_step_media ─────────────────────────

CREATE TABLE IF NOT EXISTS room_qac_sop_step_media (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sop_step_id     UUID        NOT NULL REFERENCES room_qac_sop_steps(id) ON DELETE CASCADE,
    display_order   INT         NOT NULL DEFAULT 1,
    file_url        VARCHAR(500) NOT NULL,
    file_name       VARCHAR(255) NULL,
    file_type       VARCHAR(100) NULL,
    caption         TEXT        NULL,
    uploaded_by     UUID        NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qac_step_media_step  ON room_qac_sop_step_media (sop_step_id, display_order);
CREATE INDEX IF NOT EXISTS idx_qac_step_media_count ON room_qac_sop_step_media (sop_step_id);

COMMENT ON TABLE room_qac_sop_step_media IS
    'Reference pictures for each Room QAC SOP step. Minimum 1 picture required per step.';

-- ── TABLE 3: room_qac_sop_step_audit ─────────────────────────

CREATE TABLE IF NOT EXISTS room_qac_sop_step_audit (
    id                      BIGSERIAL   PRIMARY KEY,
    sop_step_id             UUID        NULL REFERENCES room_qac_sop_steps(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_qac_audit_step   ON room_qac_sop_step_audit (sop_step_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qac_audit_action ON room_qac_sop_step_audit (action, created_at DESC);
