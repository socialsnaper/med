-- ── In-App Notifications ──────────────────────────────────────────────────────
-- Supports role-based workflow alerts for room maintenance:
--   • maintenance_created  → notify System Administrator
--   • maintenance_approved → notification (internal use)
--   • maintenance_rejected → notification (internal use)
--   • maintenance_completed → notify User Admin when Cleaning Operator stops work

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         VARCHAR(200) NOT NULL,
  message       VARCHAR(1000) NOT NULL,
  type          VARCHAR(50)  NOT NULL,         -- maintenance_created | maintenance_approved | maintenance_rejected | maintenance_completed
  related_id    UUID,                           -- e.g. room_maintenance_log.id
  is_read       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_recipient
  ON in_app_notifications (recipient_id, is_read, created_at DESC);
