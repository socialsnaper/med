-- DIGILOG — Equipment Inspection 2 SOP Steps (User Story 018)
-- Columns: S.No, Cleaning Type, Procedure, Step No., Picture (min 1)
SET search_path TO tenant_pharmacore;

CREATE TABLE IF NOT EXISTS equ_inspection2_sop_steps (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    slid                    INT         NOT NULL,
    cleaning_type_id        UUID        NOT NULL REFERENCES room_cleaning_types(id) ON DELETE RESTRICT,
    step_number             INT         NOT NULL,
    procedure_text          TEXT        NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','approved','rejected','archived')),
    CONSTRAINT uq_equ_insp2_step_per_type UNIQUE (cleaning_type_id, step_number),
    authorized_by           UUID        NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    authorized_at           TIMESTAMPTZ NULL,
    authorization_remarks   TEXT        NULL,
    created_by              UUID        NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    updated_by              UUID        NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_equ_insp2_steps_type   ON equ_inspection2_sop_steps (cleaning_type_id, step_number) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_equ_insp2_steps_type2  ON equ_inspection2_sop_steps (cleaning_type_id);

CREATE TABLE IF NOT EXISTS equ_inspection2_sop_step_media (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sop_step_id     UUID        NOT NULL REFERENCES equ_inspection2_sop_steps(id) ON DELETE CASCADE,
    display_order   INT         NOT NULL DEFAULT 1,
    file_url        VARCHAR(500) NOT NULL,
    file_name       VARCHAR(255) NULL,
    file_type       VARCHAR(100) NULL,
    caption         TEXT        NULL,
    uploaded_by     UUID        NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_equ_insp2_media ON equ_inspection2_sop_step_media (sop_step_id, display_order);
