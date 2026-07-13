-- ============================================================
-- Migration: Add TOTP / 2FA columns to users table
-- Schema: tenant_<company_name>  (run per-tenant schema)
-- ============================================================

ALTER TABLE tenant_medsync.users
  ADD COLUMN totp_secret        TEXT        DEFAULT NULL,
  ADD COLUMN totp_enabled       BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN totp_last_used_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN two_fa_reset_by    UUID        DEFAULT NULL,
  ADD COLUMN two_fa_reset_at    TIMESTAMPTZ DEFAULT NULL;

-- FK: two_fa_reset_by → users.id (self-referencing, nullable)
ALTER TABLE tenant_medsync.users
  ADD CONSTRAINT fk_users_two_fa_reset_by
  FOREIGN KEY (two_fa_reset_by)
  REFERENCES tenant_medsync.users(id)
  ON DELETE SET NULL;

-- Index for audit queries ("who reset 2FA for whom, when?")
CREATE INDEX idx_users_two_fa_reset_by ON tenant_medsync.users(two_fa_reset_by)
  WHERE two_fa_reset_by IS NOT NULL;

-- ============================================================
-- GMP audit note: totp_last_used_at prevents replay attacks.
-- Always compare incoming TOTP code timestamp against this
-- value before accepting; update it atomically on success.
-- ============================================================