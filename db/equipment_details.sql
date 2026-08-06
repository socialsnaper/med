-- ─────────────────────────────────────────────────────────────────────────────
-- equipment_details.sql
-- Equipment Details master table (per-tenant schema)
-- Run this in each tenant schema (e.g. SET search_path = tenant_pharmacore;)
-- ─────────────────────────────────────────────────────────────────────────────
SET search_path TO tenant_pharmacore;

CREATE TABLE IF NOT EXISTS equipment_details (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id        VARCHAR(20) NOT NULL UNIQUE,          -- EQ-001, EQ-002 …
    equipment_name      VARCHAR(150) NOT NULL UNIQUE,
    serial_no           VARCHAR(100),
    -- JSON array of process_type UUIDs, e.g. ["uuid1","uuid2"]
    supported_processes JSONB       NOT NULL DEFAULT '[]',
    -- fixed | movable
    equipment_type      VARCHAR(20) NOT NULL DEFAULT 'fixed',
    manufacturer        VARCHAR(150),
    purchase_date       DATE,
    commission_date     DATE,
    decommission_date   DATE,
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    created_by          UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_by          UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_details_is_active    ON equipment_details (is_active);
CREATE INDEX IF NOT EXISTS idx_equipment_details_type         ON equipment_details (equipment_type);
CREATE INDEX IF NOT EXISTS idx_equipment_details_equipment_id ON equipment_details (equipment_id);
