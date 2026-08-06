-- ============================================================
-- DIGILOG — Add scale_name column to scales table
-- Run after scale.sql
-- ============================================================

SET search_path TO tenant_pharmacore;

ALTER TABLE scales
    ADD COLUMN IF NOT EXISTS scale_name VARCHAR(150) NULL;
