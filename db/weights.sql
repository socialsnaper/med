
SET search_path TO tenant_pharmacore;
-- ============================================================
-- DIGILOG — Standard Weights Module
-- PostgreSQL 15+
--
-- WHAT THIS FILE CONTAINS:
--   TABLE 1 : standard_weights
--             Master list of physical reference weights used
--             to verify and calibrate weighing scales
--             e.g. WT-001 (1 kg), WT-002 (5 kg)
--
--   TABLE 2 : weight_calibration_logs
--             History of every calibration event for each
--             reference weight. Append-only GMP record.
--
-- WHERE IT LIVES:
--   Tenant schema — e.g. tenant_pharmacore
--   Run after digilog_login.sql (users table must exist)
--
-- WHAT IS A STANDARD WEIGHT?
--   A certified physical metal weight used as a reference
--   standard when verifying or calibrating weighing scales.
--   e.g. A 1 kg certified stainless steel weight (WT-001)
--   is placed on a scale to check if the scale reads exactly
--   1 kg. If not, the scale needs calibration.
--
--   GMP requires these reference weights themselves to be
--   periodically calibrated against national standards
--   (NABL-certified labs in India) and their calibration
--   certificates maintained.
--
-- FROM YOUR SCREEN (image):
--   Columns: S.No, Std Weight S/N, Standard Weight,
--            Last Calibrated On, Next Calibration Due,
--            Tolerance Limit, Actions
--
-- CONNECTS TO:
--   → scales table (next module)
--       A scale is verified USING a standard weight
--   → scale_verification_logs
--       Records which standard weight was used in each
--       scale verification event
--
-- DEPENDS ON:
--   users table — for created_by, updated_by audit fields
-- ============================================================


-- ============================================================
-- TABLE 1: standard_weights
-- Master record for each physical reference weight
-- One row = one physical calibration weight in the facility
-- ============================================================

CREATE TABLE IF NOT EXISTS standard_weights (

    -- ── IDENTIFIERS ──────────────────────────────────────────

    -- Internal UUID — used as FK in scale_verification_logs
    id                          UUID            PRIMARY KEY
                                                DEFAULT gen_random_uuid(),

    -- Sequential display number — S.No column in UI
    slid                        SERIAL          NOT NULL,

    -- Serial number of the physical weight — shown as
    -- "Std Weight S/N" in your screen
    -- Format: WT-001, WT-002 etc.
    -- Unique — each physical weight has its own serial number
    weight_serial_no            VARCHAR(20)     NOT NULL UNIQUE,

    -- The nominal value of this weight
    -- Stored as a display string matching the screen
    -- e.g. "1 kg", "5 kg", "10 kg", "500 g", "200 g"
    -- VARCHAR not NUMERIC because the unit is part of the value
    standard_weight             VARCHAR(20)     NOT NULL,

    -- Numeric value in grams for comparison and sorting
    -- e.g. 1 kg → 1000.00, 500 g → 500.00
    -- Allows sorting "1 kg, 5 kg, 10 kg" correctly
    -- and range queries like "all weights above 5 kg"
    weight_value_grams          NUMERIC(12, 4)  NOT NULL,

    -- ── CALIBRATION DETAILS ───────────────────────────────────

    -- When this weight was last calibrated
    -- Matches "Last Calibrated On" column in your screen
    last_calibrated_on          DATE            NULL,

    -- When the next calibration is due
    -- Matches "Next Calibration Due" column in your screen
    -- Computed by application based on calibration_interval_days
    -- but stored explicitly so it can be queried directly
    -- e.g. "show all weights due for calibration this month"
    next_calibration_due        DATE            NULL,

    -- How many days between calibrations
    -- e.g. 365 = annual calibration
    -- Used by application to compute next_calibration_due
    -- when a new calibration log is recorded
    calibration_interval_days   INT             NOT NULL DEFAULT 365,

    -- Allowed deviation from the nominal value
    -- Matches "Tolerance Limit" column in your screen
    -- Stored as display string e.g. "±0.01 g", "±0.02 g"
    -- VARCHAR because the ± symbol and unit are part of value
    tolerance_limit             VARCHAR(20)     NULL,

    -- Numeric tolerance in grams for validation logic
    -- e.g. "±0.01 g" → 0.01
    -- Used when checking if a scale reading is within tolerance
    tolerance_grams             NUMERIC(10, 6)  NULL,

    -- ── CERTIFICATION DETAILS ────────────────────────────────

    -- Name of the calibration lab that certified this weight
    -- e.g. "NABL Accredited Lab - Mumbai", "NPL India"
    -- GMP requires traceable calibration from certified labs
    calibration_lab             VARCHAR(150)    NULL,

    -- Certificate number issued by the calibration lab
    -- Regulators ask for this during audits
    certificate_number          VARCHAR(100)    NULL,

    -- S3 URL of the scanned calibration certificate PDF
    -- Regulators may ask to see the actual certificate
    certificate_url             VARCHAR(500)    NULL,

    -- ── PHYSICAL DETAILS ─────────────────────────────────────

    -- Material the weight is made of
    -- e.g. "Stainless Steel (AISI 316)", "Cast Iron"
    -- GMP requires non-corrosive materials
    material                    VARCHAR(100)    NULL,

    -- OIML or ASTM accuracy class of this weight
    -- e.g. "Class E2", "Class F1", "Class M1"
    -- Determines acceptable tolerance range
    accuracy_class              VARCHAR(20)     NULL,

    -- Physical location where this weight is stored
    -- e.g. "QC Lab Cabinet 2", "Weighing Room"
    storage_location            VARCHAR(150)    NULL,

    -- ── STATUS ───────────────────────────────────────────────

    -- Whether this weight is currently in service
    -- FALSE = retired or lost — soft delete
    -- Never hard-delete — calibration history must be preserved
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,

    -- If weight is out of service, reason why
    -- e.g. "Damaged — chipped edge", "Lost", "Retired"
    inactive_reason             TEXT            NULL,

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

-- Lookup by serial number — most common query
CREATE INDEX IF NOT EXISTS idx_std_weights_serial
    ON standard_weights (weight_serial_no);

-- Find weights due for calibration
-- Most important operational query — run monthly
CREATE INDEX IF NOT EXISTS idx_std_weights_cal_due
    ON standard_weights (next_calibration_due)
    WHERE is_active = TRUE;

-- Active weights only — used in scale verification dropdowns
CREATE INDEX IF NOT EXISTS idx_std_weights_active
    ON standard_weights (is_active)
    WHERE is_active = TRUE;

-- Sort by weight value — display in ascending weight order
CREATE INDEX IF NOT EXISTS idx_std_weights_value
    ON standard_weights (weight_value_grams);

-- Ordered display in list screen (by SLID)
CREATE INDEX IF NOT EXISTS idx_std_weights_slid
    ON standard_weights (slid);

-- ── COMMENTS ─────────────────────────────────────────────────

COMMENT ON TABLE standard_weights IS
    'Master list of physical reference calibration weights used to verify weighing scales. GMP requires periodic calibration of these weights themselves.';

COMMENT ON COLUMN standard_weights.weight_serial_no IS
    'Unique serial number of the physical weight e.g. WT-001. Shown as Std Weight S/N in UI.';

COMMENT ON COLUMN standard_weights.standard_weight IS
    'Display value including unit e.g. "1 kg", "500 g". Matches exactly what is shown on screen.';

COMMENT ON COLUMN standard_weights.weight_value_grams IS
    'Numeric value in grams for sorting and comparison. e.g. 1 kg = 1000.0000 g.';

COMMENT ON COLUMN standard_weights.next_calibration_due IS
    'Pre-computed due date. Updated by application when calibration log is recorded. Enables direct date queries.';

COMMENT ON COLUMN standard_weights.tolerance_limit IS
    'Display string e.g. ±0.01 g. Matches Tolerance Limit column on screen.';

COMMENT ON COLUMN standard_weights.tolerance_grams IS
    'Numeric tolerance for validation logic. e.g. ±0.01 g stores 0.01 here.';

COMMENT ON COLUMN standard_weights.accuracy_class IS
    'OIML or ASTM class e.g. Class E2, F1, M1. Determines acceptable deviation range.';


-- ============================================================
-- TABLE 2: weight_calibration_logs
-- History of every calibration event for each standard weight
-- APPEND-ONLY — GMP audit trail
-- Regulators need to see the complete calibration history
-- ============================================================

CREATE TABLE IF NOT EXISTS weight_calibration_logs (

    -- BIGSERIAL — sequential proves no records deleted
    -- Same reasoning as login_audit
    id                          BIGSERIAL       PRIMARY KEY,

    -- Which physical weight was calibrated
    -- RESTRICT — cannot delete a weight that has calibration logs
    weight_id                   UUID            NOT NULL
                                    REFERENCES standard_weights(id)
                                    ON DELETE RESTRICT,

    -- ── CALIBRATION EVENT DETAILS ────────────────────────────

    -- When the calibration was performed
    calibration_date            DATE            NOT NULL,

    -- Name of the external calibration lab
    calibration_lab             VARCHAR(150)    NULL,

    -- Certificate number from the calibration lab
    certificate_number          VARCHAR(100)    NULL,

    -- S3 URL of the calibration certificate PDF
    certificate_url             VARCHAR(500)    NULL,

    -- Nominal value of the weight
    -- Copied at time of logging — in case weight record changes
    nominal_value_grams         NUMERIC(12, 4)  NOT NULL,

    -- Actual value measured during calibration
    actual_value_grams          NUMERIC(12, 4)  NULL,

    -- Deviation = actual - nominal
    -- Positive = heavier than nominal
    -- Negative = lighter than nominal
    deviation_grams             NUMERIC(10, 6)  NULL,

    -- Whether calibration passed or failed
    -- PASS = deviation within tolerance_grams
    -- FAIL = deviation exceeds tolerance — weight must be retired
    result                      VARCHAR(10)     NOT NULL
                                    CHECK (result IN ('PASS', 'FAIL')),

    -- Validity period of this calibration certificate
    -- When the next calibration must happen
    -- Application copies this to standard_weights.next_calibration_due
    valid_until                 DATE            NULL,

    -- Any remarks from the calibration lab or QC team
    remarks                     TEXT            NULL,

    -- ── WHO RECORDED THIS ────────────────────────────────────

    -- Who entered this calibration record into DIGILOG
    -- Not necessarily who performed the calibration
    -- (external lab performs, QC team records in system)
    recorded_by                 UUID            NULL
                                    REFERENCES users(id)
                                    ON DELETE SET NULL,

    -- When this record was entered into the system
    -- Separate from calibration_date — may be entered days later
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()

    -- NO updated_at — this is an append-only audit record
    -- If a mistake was made, add a corrective entry with remarks
    -- Never update or delete calibration records

);

-- ── INDEXES ──────────────────────────────────────────────────

-- Get calibration history for one weight — most common query
CREATE INDEX IF NOT EXISTS idx_weight_cal_logs_weight
    ON weight_calibration_logs (weight_id, calibration_date DESC);

-- Find all failed calibrations — QC review
CREATE INDEX IF NOT EXISTS idx_weight_cal_logs_result
    ON weight_calibration_logs (result, calibration_date DESC);

-- Date-range queries — "calibrations done this year"
CREATE INDEX IF NOT EXISTS idx_weight_cal_logs_date
    ON weight_calibration_logs (calibration_date DESC);

-- ── COMMENTS ─────────────────────────────────────────────────

COMMENT ON TABLE weight_calibration_logs IS
    'Append-only calibration history for each standard weight. GMP requirement — records never updated or deleted.';

COMMENT ON COLUMN weight_calibration_logs.deviation_grams IS
    'actual_value_grams minus nominal_value_grams. Negative = lighter than nominal.';

COMMENT ON COLUMN weight_calibration_logs.result IS
    'PASS = deviation within tolerance. FAIL = weight out of tolerance — must be retired from use.';

COMMENT ON COLUMN weight_calibration_logs.recorded_by IS
    'User who entered this record in DIGILOG. May differ from the lab that performed calibration.';


-- ── AUTO-UPDATE TRIGGER ───────────────────────────────────────

-- CREATE OR REPLACE TRIGGER trg_standard_weights_updated_at
--     BEFORE UPDATE ON standard_weights
--     FOR EACH ROW
--     EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SEED DATA — Standard Weights
-- Matches the 5 rows visible in your screen (image)
-- with realistic pharmaceutical factory weight sets
-- ============================================================

INSERT INTO standard_weights (
    weight_serial_no,
    standard_weight,
    weight_value_grams,
    last_calibrated_on,
    next_calibration_due,
    calibration_interval_days,
    tolerance_limit,
    tolerance_grams,
    calibration_lab,
    certificate_number,
    material,
    accuracy_class,
    storage_location,
    is_active
)
VALUES

    -- From your screen (image 19) — exact values
    (
        'WT-001', '1 kg',   1000.0000,
        '2025-03-10', '2026-03-10', 365,
        '±0.01 g',  0.010000,
        'NABL Accredited Metrology Lab',
        'CAL-2025-WT001',
        'Stainless Steel (AISI 316)',
        'Class F1',
        'QC Lab - Cabinet 1',
        TRUE
    ),
    (
        'WT-002', '5 kg',   5000.0000,
        '2025-02-15', '2026-02-15', 365,
        '±0.02 g',  0.020000,
        'NABL Accredited Metrology Lab',
        'CAL-2025-WT002',
        'Stainless Steel (AISI 316)',
        'Class F1',
        'QC Lab - Cabinet 1',
        TRUE
    ),
    (
        'WT-003', '10 kg',  10000.0000,
        '2025-01-01', '2026-01-01', 365,
        '±0.05 g',  0.050000,
        'NABL Accredited Metrology Lab',
        'CAL-2025-WT003',
        'Stainless Steel (AISI 316)',
        'Class F1',
        'QC Lab - Cabinet 1',
        TRUE
    ),
    (
        'WT-004', '20 kg',  20000.0000,
        '2025-03-20', '2026-03-20', 365,
        '±0.10 g',  0.100000,
        'NABL Accredited Metrology Lab',
        'CAL-2025-WT004',
        'Stainless Steel (AISI 316)',
        'Class M1',
        'QC Lab - Cabinet 2',
        TRUE
    ),
    (
        'WT-005', '50 kg',  50000.0000,
        '2025-04-05', '2026-04-05', 365,
        '±0.20 g',  0.200000,
        'NABL Accredited Metrology Lab',
        'CAL-2025-WT005',
        'Stainless Steel (AISI 316)',
        'Class M1',
        'QC Lab - Cabinet 2',
        TRUE
    ),

    -- Additional common pharma weight set
    (
        'WT-006', '200 g',  200.0000,
        '2025-03-10', '2026-03-10', 365,
        '±0.005 g', 0.005000,
        'NABL Accredited Metrology Lab',
        'CAL-2025-WT006',
        'Stainless Steel (AISI 316)',
        'Class E2',
        'QC Lab - Cabinet 1',
        TRUE
    ),
    (
        'WT-007', '500 g',  500.0000,
        '2025-03-10', '2026-03-10', 365,
        '±0.008 g', 0.008000,
        'NABL Accredited Metrology Lab',
        'CAL-2025-WT007',
        'Stainless Steel (AISI 316)',
        'Class E2',
        'QC Lab - Cabinet 1',
        TRUE
    ),
    (
        'WT-008', '100 g',  100.0000,
        '2025-03-10', '2026-03-10', 365,
        '±0.003 g', 0.003000,
        'NABL Accredited Metrology Lab',
        'CAL-2025-WT008',
        'Stainless Steel (AISI 316)',
        'Class E2',
        'QC Lab - Cabinet 1',
        TRUE
    )

ON CONFLICT (weight_serial_no) DO NOTHING;


-- ============================================================
-- SEED — Sample calibration log entries
-- Shows how calibration history is recorded
-- ============================================================

INSERT INTO weight_calibration_logs (
    weight_id,
    calibration_date,
    calibration_lab,
    certificate_number,
    nominal_value_grams,
    actual_value_grams,
    deviation_grams,
    result,
    valid_until,
    remarks
)
VALUES

    -- WT-001 (1 kg) — passed calibration
    (
        (SELECT id FROM standard_weights WHERE weight_serial_no = 'WT-001'),
        '2025-03-10',
        'NABL Accredited Metrology Lab',
        'CAL-2025-WT001',
        1000.0000, 1000.0072, 0.007200,
        'PASS', '2026-03-10',
        'Deviation within Class F1 tolerance. Certificate valid for 12 months.'
    ),

    -- WT-002 (5 kg) — passed calibration
    (
        (SELECT id FROM standard_weights WHERE weight_serial_no = 'WT-002'),
        '2025-02-15',
        'NABL Accredited Metrology Lab',
        'CAL-2025-WT002',
        5000.0000, 5000.0145, 0.014500,
        'PASS', '2026-02-15',
        'Within tolerance. No corrective action required.'
    ),

    -- WT-003 (10 kg) — passed
    (
        (SELECT id FROM standard_weights WHERE weight_serial_no = 'WT-003'),
        '2025-01-01',
        'NABL Accredited Metrology Lab',
        'CAL-2025-WT003',
        10000.0000, 10000.0310, 0.031000,
        'PASS', '2026-01-01',
        'Calibration passed. Stored as per standard procedure.'
    );


-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Full list matching your screen layout exactly
SELECT
    sw.slid                         AS "S.No",
    sw.weight_serial_no             AS "Std Weight S/N",
    sw.standard_weight              AS "Standard Weight",
    sw.last_calibrated_on           AS "Last Calibrated On",
    sw.next_calibration_due         AS "Next Calibration Due",
    sw.tolerance_limit              AS "Tolerance Limit",
    sw.accuracy_class               AS "Class",
    sw.is_active                    AS "Active"
FROM standard_weights sw
ORDER BY sw.weight_value_grams;

-- Weights due for calibration in next 30 days — operational alert
SELECT
    weight_serial_no                AS "S/N",
    standard_weight                 AS "Weight",
    next_calibration_due            AS "Due Date",
    next_calibration_due - CURRENT_DATE AS "Days Remaining"
FROM standard_weights
WHERE is_active = TRUE
  AND next_calibration_due <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY next_calibration_due;

-- Overdue calibrations — critical alert
SELECT
    weight_serial_no                AS "S/N",
    standard_weight                 AS "Weight",
    next_calibration_due            AS "Was Due",
    CURRENT_DATE - next_calibration_due AS "Days Overdue"
FROM standard_weights
WHERE is_active = TRUE
  AND next_calibration_due < CURRENT_DATE
ORDER BY next_calibration_due;

-- Calibration history for all weights
SELECT
    sw.weight_serial_no             AS "S/N",
    sw.standard_weight              AS "Weight",
    wcl.calibration_date            AS "Calibrated On",
    wcl.calibration_lab             AS "Lab",
    wcl.actual_value_grams          AS "Actual (g)",
    wcl.deviation_grams             AS "Deviation (g)",
    wcl.result                      AS "Result",
    wcl.valid_until                 AS "Valid Until"
FROM weight_calibration_logs wcl
JOIN standard_weights sw ON sw.id = wcl.weight_id
ORDER BY wcl.calibration_date DESC;

-- Summary counts
SELECT
    'standard_weights'          AS "Table",
    COUNT(*)                    AS "Total",
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END) AS "Active"
FROM standard_weights
UNION ALL
SELECT
    'weight_calibration_logs',
    COUNT(*), NULL
FROM weight_calibration_logs;

-- ============================================================
-- END OF FILE
-- ============================================================