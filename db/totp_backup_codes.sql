-- ================================================================
-- New table: totp_backup_codes
-- Schema: tenant_medsync
-- Purpose: One-time recovery codes for TOTP 2FA bypass
-- ================================================================

CREATE TABLE tenant_medsync.totp_backup_codes (
    id          UUID            NOT NULL DEFAULT gen_random_uuid(),
    user_id     UUID            NOT NULL,
    code_hash   VARCHAR(255)    NOT NULL,
    is_used     BOOLEAN         NOT NULL DEFAULT FALSE,
    used_at     TIMESTAMPTZ     DEFAULT NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Primary key
    CONSTRAINT pk_totp_backup_codes
        PRIMARY KEY (id),

    -- FK → tenant_medsync.users with cascade delete
    CONSTRAINT fk_totp_backup_codes_user
        FOREIGN KEY (user_id)
        REFERENCES tenant_medsync.users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    -- Guard: used_at must be NULL when is_used is FALSE
    -- and must be set when is_used is TRUE
    CONSTRAINT chk_backup_code_used_at
        CHECK (
            (is_used = FALSE AND used_at IS NULL) OR
            (is_used = TRUE  AND used_at IS NOT NULL)
        )
);

-- ----------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------

-- Primary lookup: fetch all active codes for a user at login time
CREATE INDEX idx_totp_backup_codes_user_id
    ON tenant_medsync.totp_backup_codes(user_id);

-- Partial index: only unused codes — keeps the index tiny
-- and speeds up the "find a valid code" check at login
CREATE INDEX idx_totp_backup_codes_unused
    ON tenant_medsync.totp_backup_codes(user_id)
    WHERE is_used = FALSE;

-- ----------------------------------------------------------------
-- Row-level security (recommended for tenant isolation)
-- ----------------------------------------------------------------

ALTER TABLE tenant_medsync.totp_backup_codes ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- Comment block — GMP audit documentation
-- ----------------------------------------------------------------

COMMENT ON TABLE tenant_medsync.totp_backup_codes IS
    'One-time TOTP recovery codes. Each code is bcrypt-hashed before storage. '
    'Codes are single-use: is_used flips to TRUE and used_at is stamped atomically '
    'on consumption. Cascade delete ensures codes are purged when the user is removed.';

COMMENT ON COLUMN tenant_medsync.totp_backup_codes.code_hash IS
    'bcrypt hash of the plaintext backup code. Raw codes are generated in application '
    'layer, shown to the user once, then discarded. Never store plaintext here.';

COMMENT ON COLUMN tenant_medsync.totp_backup_codes.is_used IS
    'TRUE = code consumed and permanently invalid. Check this before accepting a code.';

COMMENT ON COLUMN tenant_medsync.totp_backup_codes.used_at IS
    'Timestamp of consumption — GMP audit trail. NULL while is_used = FALSE. '
    'Must be set in the same transaction that flips is_used to TRUE.';