-- ============================================================
-- DIGILOG — Scales Module
-- PostgreSQL 15+
--
-- WHAT THIS FILE CONTAINS:
--   TABLE 1 : scales
--             Master record of every physical weighing scale
--             in the pharmaceutical facility
--             e.g. SC-001 (SN-1001), SC-002 (SN-1002)
--
--   TABLE 2 : scale_verification_logs
--             Records every periodic verification event
--             (done in-house using standard weights)
--             Append-only GMP record
--
--   TABLE 3 : scale_calibration_logs
--             Records every external calibration event
--             (done by NABL-certified lab)
--             Append-only GMP record
--
-- WHERE IT LIVES:
--   Tenant schema — e.g. tenant_pharmacore
--   Run after digilog_weights.sql
--   (standard_weights table must exist for FK reference)
--
-- WHAT IS THE DIFFERENCE BETWEEN VERIFICATION AND CALIBRATION?
--
--   VERIFICATION (daily / weekly / periodic)
--     → Done IN-HOUSE by QC or operator
--     → Places a certified standard weight (WT-001) on the scale
--     → Checks if the scale reading matches the known weight
--     → If reading is within tolerance = PASS, scale can be used
--     → If reading is out of tolerance = FAIL, scale quarantined
--     → Recorded with a Form Verification Number (FV-001)
--     → NO external lab involved
--
--   CALIBRATION (periodic — typically annual)
--     → Done by NABL-ACCREDITED EXTERNAL LAB
--     → Full metrological examination and adjustment
--     → Issues a calibration certificate
--     → Recorded with a Form Calibration Number (FC-001)
--     → Much more rigorous than verification
--
--   ANALOGY:
--     Verification = checking your bathroom scale every morning
--                    with a known 1 kg object
--     Calibration  = sending your scale to a certified lab
--                    annually for full inspection
--
-- FROM YOUR SCREEN:
--   Scale ID    = SC-001 (internal DIGILOG code)
--   Scale No.   = SN-1001 (manufacturer serial number)
--   Min Range   = minimum weight the scale can measure (1 g)
--   Max Range   = maximum weight the scale can measure (200 g)
--   Capacity    = maximum load capacity (200 g)
--   Least Count = smallest division / readability (0.01 g)
--   Verified on = date of last verification
--   Calibrated Due = when next calibration is due
--   Form Veri No = internal verification form number (FV-001)
--   Form Cali No = internal calibration form number (FC-001)
--
-- CONNECTS TO:
--   → standard_weights — which weight was used in verification
--   → tenant_pharmacore.rooms — which room the scale is located in
--   → batch_process_steps — which scale was used for weighing
--
-- DEPENDS ON:
--   users table, standard_weights table, tenant_pharmacore.rooms table
-- ============================================================


-- ============================================================
-- TABLE 1: scales
-- Master record for each physical weighing instrument
-- One row = one physical scale in the facility
-- ============================================================

SET search_path TO tenant_pharmacore;
CREATE TABLE IF NOT EXISTS scales (

    -- ── IDENTIFIERS ──────────────────────────────────────────

    -- Internal UUID — FK target for verification and batch logs
    id                          UUID            PRIMARY KEY
                                                DEFAULT gen_random_uuid(),

    -- Sequential S.No for display in list screen
    slid                        SERIAL          NOT NULL,

    -- DIGILOG internal scale code — "Scale ID" column
    -- Format: SC-001, SC-002 etc.
    -- Application generates — DB enforces uniqueness
    scale_id                    VARCHAR(20)     NOT NULL UNIQUE,

    -- Manufacturer serial number — "Scale No." column
    -- e.g. SN-1001, SN-1002
    -- The physical number printed on the scale itself
    scale_number                VARCHAR(50)     NOT NULL UNIQUE,

    -- ── MEASUREMENT SPECIFICATIONS ────────────────────────────
    -- All stored as display strings (matching screen format)
    -- e.g. "1 g", "200 g", "5 kg", "0.01 g"
    -- Numeric equivalents stored separately for validation

    -- Minimum weight the scale can accurately measure
    -- "Min Range" column on screen
    min_range                   VARCHAR(20)     NULL,
    min_range_grams             NUMERIC(12, 6)  NULL,   -- numeric for validation

    -- Maximum weight the scale can measure
    -- "Max Range" column on screen
    max_range                   VARCHAR(20)     NULL,
    max_range_grams             NUMERIC(12, 6)  NULL,   -- numeric for validation

    -- Maximum load the scale can bear without damage
    -- "Capacity" column on screen
    -- Usually same as max_range but can differ
    capacity                    VARCHAR(20)     NULL,
    capacity_grams              NUMERIC(12, 6)  NULL,   -- numeric for validation

    -- Smallest increment the scale can display
    -- "Least Count" column on screen
    -- e.g. "0.01 g" means scale shows 2 decimal places in grams
    -- Critical for deciding if this scale is precise enough
    -- for a particular weighing task
    least_count                 VARCHAR(20)     NULL,
    least_count_grams           NUMERIC(12, 8)  NULL,   -- numeric for validation

    -- ── VERIFICATION TRACKING ─────────────────────────────────
    -- Verification = in-house check using standard weights

    -- Date of last verification — "Verified on" column
    last_verified_on            DATE            NULL,

    -- When next verification is due
    -- Application computes based on verification_interval_days
    next_verification_due       DATE            NULL,

    -- How often this scale must be verified (in days)
    -- e.g. 1 = daily verification, 7 = weekly, 30 = monthly
    verification_interval_days  INT             NOT NULL DEFAULT 1,

    -- Internal form number for the last verification activity
    -- "Form Veri No." column on screen — e.g. FV-001
    -- Links to physical paper form or PDF record
    form_verification_no        VARCHAR(20)     NULL,

    -- ── CALIBRATION TRACKING ─────────────────────────────────
    -- Calibration = external NABL lab activity

    -- When next external calibration is due
    -- "Calibrated Due" column on screen
    next_calibration_due        DATE            NULL,

    -- How often external calibration must happen (in days)
    -- e.g. 365 = annual calibration
    calibration_interval_days   INT             NOT NULL DEFAULT 365,

    -- Internal form number for the last calibration activity
    -- "Form Cali No." column on screen — e.g. FC-001
    form_calibration_no         VARCHAR(20)     NULL,

    -- ── PHYSICAL DETAILS ─────────────────────────────────────

    -- Make/brand of the scale
    -- e.g. "Mettler Toledo", "Sartorius", "Ohaus", "Citizen"
    manufacturer                VARCHAR(100)    NULL,

    -- Model name/number from manufacturer
    -- e.g. "ME204", "CPA2202S", "Pioneer PA2102"
    model_number                VARCHAR(100)    NULL,

    -- Type of scale
    -- analytical = very high precision (0.0001 g), lab use
    -- precision  = high precision (0.01 g), dispensing use
    -- industrial = large capacity (kg range), production use
    -- moisture   = moisture analyzer / moisture balance
    scale_type                  VARCHAR(20)     NULL
                                    CHECK (scale_type IN (
                                        'analytical',
                                        'precision',
                                        'industrial',
                                        'moisture',
                                        'other'
                                    )),

---Todo later on
    -- -- Which room the scale is physically located in
    -- -- NULL = portable / not permanently assigned
    -- room_id                     UUID            NULL
    --                                 REFERENCES tenant_pharmacore.rooms(id)
    --                                 ON DELETE SET NULL,

    -- ── STATUS ───────────────────────────────────────────────

    -- Current operational status of this scale
    -- active      = in use, verified, available for weighing
    -- quarantined = failed verification — cannot be used
    --               until recalibrated and re-verified
    -- under_repair = sent for repair, not available
    -- retired     = permanently out of service
    status                      VARCHAR(20)     NOT NULL DEFAULT 'active'
                                    CHECK (status IN (
                                        'active',
                                        'quarantined',
                                        'under_repair',
                                        'retired'
                                    )),

    -- Reason for quarantine or retirement
    -- NULL if status = 'active'
    status_reason               TEXT            NULL,

    -- FALSE = soft-deleted — never hard-delete
    -- Batch records that used this scale must remain traceable
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,

    -- ── AUDIT FIELDS ─────────────────────────────────────────

    created_by                  UUID            NULL
                                    REFERENCES users(id)
                                    ON DELETE SET NULL,

    updated_by                  UUID            NULL
                                    REFERENCES users(id)
                                    ON DELETE SET NULL,

    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()

);

-- ── INDEXES ──────────────────────────────────────────────────

-- Lookup by scale_id — most common query
CREATE INDEX IF NOT EXISTS idx_scales_scale_id
    ON scales (scale_id);

-- Lookup by scale_number — used in imports
CREATE INDEX IF NOT EXISTS idx_scales_scale_number
    ON scales (scale_number);

-- -- Find scales by room — "which scales are in Room RM-101?"
-- CREATE INDEX IF NOT EXISTS idx_scales_room
--     ON scales (room_id)
--     WHERE room_id IS NOT NULL;

-- Active scales only — used in batch weighing dropdowns
CREATE INDEX IF NOT EXISTS idx_scales_active
    ON scales (is_active, status)
    WHERE is_active = TRUE AND status = 'active';

-- Verification due date — most important operational query
CREATE INDEX IF NOT EXISTS idx_scales_verification_due
    ON scales (next_verification_due)
    WHERE is_active = TRUE;

-- Calibration due date — periodic alert query
CREATE INDEX IF NOT EXISTS idx_scales_calibration_due
    ON scales (next_calibration_due)
    WHERE is_active = TRUE;

-- SLID ordering for list screen
CREATE INDEX IF NOT EXISTS idx_scales_slid
    ON scales (slid);

-- ── COMMENTS ─────────────────────────────────────────────────

COMMENT ON TABLE scales IS
    'Master record of all weighing scales in the facility. Tracks both verification (in-house) and calibration (external lab) schedules.';

COMMENT ON COLUMN scales.scale_id IS
    'DIGILOG internal code e.g. SC-001. Shown as Scale ID on screen.';

COMMENT ON COLUMN scales.scale_number IS
    'Manufacturer serial number printed on the physical scale. Shown as Scale No. on screen.';

COMMENT ON COLUMN scales.least_count IS
    'Smallest division displayable e.g. 0.01 g. Determines precision of weighing operations.';

COMMENT ON COLUMN scales.verification_interval_days IS
    'How often in-house verification must happen. 1 = daily. Application alerts when overdue.';

COMMENT ON COLUMN scales.form_verification_no IS
    'Internal form reference number for last verification. Shown as Form Veri No. on screen.';

COMMENT ON COLUMN scales.form_calibration_no IS
    'Internal form reference number for last calibration. Shown as Form Cali No. on screen.';

COMMENT ON COLUMN scales.status IS
    'active = usable. quarantined = failed verification, cannot be used. under_repair = in service. retired = permanently decommissioned.';


-- ============================================================
-- TABLE 2: scale_verification_logs
-- Records every in-house verification event
-- Done using certified standard weights (WT-001 etc.)
-- APPEND-ONLY — GMP audit trail
-- ============================================================

CREATE TABLE IF NOT EXISTS scale_verification_logs (

    -- BIGSERIAL — sequential order proves no records deleted
    id                          BIGSERIAL       PRIMARY KEY,

    -- Which scale was verified
    -- RESTRICT — cannot delete a scale that has verification logs
    scale_id                    UUID            NOT NULL
                                    REFERENCES scales(id)
                                    ON DELETE RESTRICT,

    -- Which standard weight was used for this verification
    -- e.g. WT-001 (1 kg weight) placed on the scale
    standard_weight_id          UUID            NOT NULL
                                    REFERENCES standard_weights(id)
                                    ON DELETE RESTRICT,

    -- ── VERIFICATION EVENT DETAILS ────────────────────────────

    -- When the verification was performed
    verification_date           DATE            NOT NULL,

    -- What the scale displayed when the standard weight was placed
    -- e.g. if WT-001 (1 kg) was placed and scale showed 1000.008 g
    displayed_reading_grams     NUMERIC(12, 6)  NOT NULL,

    -- The known true value of the standard weight used
    -- Copied from standard_weights.weight_value_grams at time of log
    -- Stored here so history is preserved even if weight record changes
    reference_value_grams       NUMERIC(12, 6)  NOT NULL,

    -- Deviation = displayed_reading - reference_value
    -- Positive = scale reads higher than actual
    -- Negative = scale reads lower than actual
    deviation_grams             NUMERIC(12, 8)  NOT NULL,

    -- Tolerance limit of the scale at time of verification
    -- Copied from scales.least_count_grams or configured limit
    tolerance_grams             NUMERIC(12, 8)  NULL,

    -- PASS = deviation within tolerance — scale is accurate
    -- FAIL = deviation exceeds tolerance — scale must be quarantined
    result                      VARCHAR(10)     NOT NULL
                                    CHECK (result IN ('PASS', 'FAIL')),

    -- Internal verification form number — "Form Veri No."
    -- e.g. FV-001, FV-002
    -- Links this log to the physical or PDF form record
    form_verification_no        VARCHAR(20)     NULL,

    -- Environmental conditions at time of verification
    -- Important for high-precision analytical scales
    temperature_celsius         NUMERIC(5, 2)   NULL,
    humidity_percent            NUMERIC(5, 2)   NULL,

    -- Any remarks from the person performing verification
    remarks                     TEXT            NULL,

    -- ── WHO PERFORMED THIS ───────────────────────────────────

    -- Who performed the verification (in-house person)
    performed_by                UUID            NULL
                                    REFERENCES users(id)
                                    ON DELETE SET NULL,

    -- Who reviewed and approved this verification record
    -- Usually a supervisor or QC person
    reviewed_by                 UUID            NULL
                                    REFERENCES users(id)
                                    ON DELETE SET NULL,

    reviewed_at                 TIMESTAMPTZ     NULL,

    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()

    -- NO updated_at — append-only audit record
    -- Errors are corrected by adding a new entry with remarks

);

-- ── INDEXES ──────────────────────────────────────────────────

-- Verification history for one scale — most common query
CREATE INDEX IF NOT EXISTS idx_scale_verif_logs_scale
    ON scale_verification_logs (scale_id, verification_date DESC);

-- Find all failed verifications — QC investigation
CREATE INDEX IF NOT EXISTS idx_scale_verif_logs_result
    ON scale_verification_logs (result, verification_date DESC);

-- Verifications done with a specific standard weight
-- Impact check: "if WT-001 was out of tolerance, which
-- scale readings may be affected?"
CREATE INDEX IF NOT EXISTS idx_scale_verif_logs_weight
    ON scale_verification_logs (standard_weight_id);

-- Date range queries
CREATE INDEX IF NOT EXISTS idx_scale_verif_logs_date
    ON scale_verification_logs (verification_date DESC);

-- ── COMMENTS ─────────────────────────────────────────────────

COMMENT ON TABLE scale_verification_logs IS
    'Append-only log of in-house scale verifications using certified standard weights. GMP requirement.';

COMMENT ON COLUMN scale_verification_logs.displayed_reading_grams IS
    'What the scale showed when the standard weight was placed on it.';

COMMENT ON COLUMN scale_verification_logs.reference_value_grams IS
    'True value of the standard weight used. Copied at log time to preserve historical accuracy.';

COMMENT ON COLUMN scale_verification_logs.deviation_grams IS
    'displayed_reading_grams minus reference_value_grams. Negative = scale reads low.';

COMMENT ON COLUMN scale_verification_logs.form_verification_no IS
    'Internal form number e.g. FV-001. Shown as Form Veri No. in the scale list screen.';


-- ============================================================
-- TABLE 3: scale_calibration_logs
-- Records every external lab calibration event
-- More rigorous than verification — done by NABL lab
-- APPEND-ONLY — GMP audit trail
-- ============================================================

CREATE TABLE IF NOT EXISTS scale_calibration_logs (

    id                          BIGSERIAL       PRIMARY KEY,

    -- Which scale was calibrated
    scale_id                    UUID            NOT NULL
                                    REFERENCES scales(id)
                                    ON DELETE RESTRICT,

    -- ── CALIBRATION EVENT DETAILS ────────────────────────────

    -- When calibration was performed by external lab
    calibration_date            DATE            NOT NULL,

    -- Name of the NABL accredited calibration lab
    calibration_lab             VARCHAR(150)    NULL,

    -- Certificate number issued by the lab
    certificate_number          VARCHAR(100)    NULL,

    -- S3 URL of the calibration certificate PDF
    certificate_url             VARCHAR(500)    NULL,

    -- Internal calibration form number — "Form Cali No."
    -- e.g. FC-001, FC-002
    form_calibration_no         VARCHAR(20)     NULL,

    -- When this calibration certificate expires
    -- Application copies this to scales.next_calibration_due
    valid_until                 DATE            NULL,

    -- Overall result of external calibration
    result                      VARCHAR(10)     NOT NULL
                                    CHECK (result IN ('PASS', 'FAIL')),

    -- Remarks from calibration lab or QC team
    remarks                     TEXT            NULL,

    -- ── WHO RECORDED THIS ────────────────────────────────────

    -- Who entered this calibration in DIGILOG
    -- (QC team member, not the external lab technician)
    recorded_by                 UUID            NULL
                                    REFERENCES users(id)
                                    ON DELETE SET NULL,

    -- Who approved/reviewed this calibration record in DIGILOG
    approved_by                 UUID            NULL
                                    REFERENCES users(id)
                                    ON DELETE SET NULL,

    approved_at                 TIMESTAMPTZ     NULL,

    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()

    -- NO updated_at — append-only audit record

);

-- ── INDEXES ──────────────────────────────────────────────────

-- Calibration history for one scale
CREATE INDEX IF NOT EXISTS idx_scale_cal_logs_scale
    ON scale_calibration_logs (scale_id, calibration_date DESC);

-- Failed calibrations — require immediate action
CREATE INDEX IF NOT EXISTS idx_scale_cal_logs_result
    ON scale_calibration_logs (result, calibration_date DESC);

-- Date range
CREATE INDEX IF NOT EXISTS idx_scale_cal_logs_date
    ON scale_calibration_logs (calibration_date DESC);

-- ── COMMENTS ─────────────────────────────────────────────────

COMMENT ON TABLE scale_calibration_logs IS
    'Append-only log of external NABL lab calibration events for each scale. Separate from in-house verifications.';

COMMENT ON COLUMN scale_calibration_logs.form_calibration_no IS
    'Internal form number e.g. FC-001. Shown as Form Cali No. in scale list screen.';

COMMENT ON COLUMN scale_calibration_logs.valid_until IS
    'When calibration expires. Copied to scales.next_calibration_due by application on save.';


-- ── AUTO-UPDATE TRIGGER ───────────────────────────────────────

-- CREATE OR REPLACE TRIGGER trg_scales_updated_at
--     BEFORE UPDATE ON scales
--     FOR EACH ROW
--     EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SEED DATA — Scales
-- Matches exactly the 5 rows visible in your screen
-- ============================================================

INSERT INTO scales (
    scale_id, scale_number,
    min_range, min_range_grams,
    max_range, max_range_grams,
    capacity, capacity_grams,
    least_count, least_count_grams,
    last_verified_on,
    next_verification_due,
    verification_interval_days,
    form_verification_no,
    next_calibration_due,
    calibration_interval_days,
    form_calibration_no,
    scale_type,
    status, is_active
)
VALUES

    -- From your screen — exact values
    (
        'SC-001', 'SN-1001',
        '1 g',   0.001000,
        '200 g', 200.000000,
        '200 g', 200.000000,
        '0.01 g', 0.010000,
        '2025-03-01', '2025-03-02', 1,
        'FV-001',
        '2025-03-01', 365,
        'FC-001',
        'analytical',
        'active', TRUE
    ),
    (
        'SC-002', 'SN-1002',
        '10 g',   0.010000,
        '5 kg',   5000.000000,
        '5 kg',   5000.000000,
        '0.1 g',  0.100000,
        '2025-02-10', '2025-02-11', 1,
        'FV-002',
        '2026-02-10', 365,
        'FC-002',
        'precision',
        'active', TRUE
    ),
    (
        'SC-003', 'SN-1003',
        '50 g',    0.050000,
        '20 kg',   20000.000000,
        '20 kg',   20000.000000,
        '1 g',     1.000000,
        '2025-01-15', '2025-01-16', 1,
        'FV-003',
        '2026-01-15', 365,
        'FC-003',
        'precision',
        'active', TRUE
    ),
    (
        'SC-004', 'SN-1004',
        '100 g',   0.100000,
        '50 kg',   50000.000000,
        '50 kg',   50000.000000,
        '2 g',     2.000000,
        '2025-03-05', '2025-03-06', 1,
        'FV-004',
        '2026-03-05', 365,
        'FC-004',
        'industrial',
        'active', TRUE
    ),
    (
        'SC-005', 'SN-1005',
        '200 g',   0.200000,
        '100 kg',  100000.000000,
        '100 kg',  100000.000000,
        '5 g',     5.000000,
        '2025-02-12', '2025-02-13', 1,
        'FV-005',
        '2026-02-12', 365,
        'FC-005',
        'industrial',
        'active', TRUE
    )

ON CONFLICT (scale_id) DO NOTHING;


-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Full list matching your screen exactly
SELECT
    s.slid                          AS "S.No",
    s.scale_id                      AS "Scale ID",
    s.scale_number                  AS "Scale No.",
    s.min_range                     AS "Min Range",
    s.max_range                     AS "Max Range",
    s.capacity                      AS "Capacity",
    s.least_count                   AS "Least Count",
    s.last_verified_on              AS "Verified on",
    s.next_calibration_due          AS "Calibrated Due",
    s.form_verification_no          AS "Form Veri No.",
    s.form_calibration_no           AS "Form Cali No.",
    s.status                        AS "Status"
FROM scales s
ORDER BY s.slid;

-- Scales overdue for verification — CRITICAL daily alert
SELECT
    scale_id                        AS "Scale ID",
    scale_number                    AS "Scale No.",
    scale_type                      AS "Type",
    next_verification_due           AS "Was Due",
    CURRENT_DATE - next_verification_due AS "Days Overdue",
    status                          AS "Status"
FROM scales
WHERE is_active = TRUE
  AND status = 'active'
  AND next_verification_due < CURRENT_DATE
ORDER BY next_verification_due;

-- Scales due for calibration in next 60 days
SELECT
    scale_id                        AS "Scale ID",
    scale_number                    AS "Scale No.",
    next_calibration_due            AS "Due Date",
    next_calibration_due - CURRENT_DATE AS "Days Remaining"
FROM scales
WHERE is_active = TRUE
  AND next_calibration_due <= CURRENT_DATE + INTERVAL '60 days'
ORDER BY next_calibration_due;

-- Full verification history across all scales
SELECT
    s.scale_id                      AS "Scale ID",
    svl.verification_date           AS "Date",
    sw.weight_serial_no             AS "Std Weight Used",
    svl.displayed_reading_grams     AS "Reading (g)",
    svl.reference_value_grams       AS "Reference (g)",
    svl.deviation_grams             AS "Deviation (g)",
    svl.result                      AS "Result",
    svl.form_verification_no        AS "Form No."
FROM scale_verification_logs svl
JOIN scales s ON s.id = svl.scale_id
JOIN standard_weights sw ON sw.id = svl.standard_weight_id
ORDER BY svl.verification_date DESC;

-- Summary
SELECT 'scales' AS "Table",
    COUNT(*) AS "Total",
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END) AS "Active",
    SUM(CASE WHEN status = 'quarantined' THEN 1 ELSE 0 END) AS "Quarantined"
FROM scales
UNION ALL
SELECT 'scale_verification_logs', COUNT(*), NULL, NULL
FROM scale_verification_logs
UNION ALL
SELECT 'scale_calibration_logs', COUNT(*), NULL, NULL
FROM scale_calibration_logs;

-- ============================================================
-- END OF FILE
-- ============================================================