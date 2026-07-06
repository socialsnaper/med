-- ============================================================
-- DIGILOG — Dummy Company Seed Data
-- Run this AFTER digilog_login.sql has been executed
--
-- Creates 2 dummy companies with full user sets for testing:
--   Company 1: PharmaCore Labs     (company_code: pharmacore)
--   Company 2: MedSync Industries  (company_code: medsync)
--
-- Each company gets:
--   ✅ 1 row in public.companies
--   ✅ Their own isolated schema
--   ✅ All 21 roles seeded
--   ✅ One user per role group for testing (10 users each)
--
-- ALL PASSWORDS = Test@1234
-- bcrypt hash below is for: Test@1234
-- ============================================================


-- ============================================================
-- COMPANY 1 — PharmaCore Labs
-- ============================================================

-- Step 1: Insert company record
INSERT INTO public.companies (
    id,
    company_code,
    company_name,
    schema_name,
    logo_url,
    contact_email,
    is_active
) VALUES (
    'a1b2c3d4-0001-0001-0001-000000000001',
    'pharmacore',
    'PharmaCore Labs Pvt. Ltd.',
    'tenant_pharmacore',
    NULL,
    'admin@pharmacorelabs.com',
    TRUE
);

-- Step 2: Create isolated schema for this company
CREATE SCHEMA IF NOT EXISTS tenant_pharmacore;

-- Step 3: Create all 6 tables inside the schema
-- (same structure as in digilog_login.sql, scoped to this company)

CREATE TABLE IF NOT EXISTS tenant_pharmacore.roles (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name           VARCHAR(100)    NOT NULL UNIQUE,
    role_group          VARCHAR(50)     NULL,
    permissions         JSONB           NOT NULL DEFAULT '{}',
    is_system_role      BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_by          UUID            NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_pharmacore.users (
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id              UUID            NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    role_id                 UUID            NOT NULL REFERENCES tenant_pharmacore.roles(id) ON DELETE RESTRICT,
    username                VARCHAR(100)    NOT NULL UNIQUE,
    email                   VARCHAR(255)    NOT NULL UNIQUE,
    password_hash           VARCHAR(255)    NOT NULL,
    first_name              VARCHAR(100)    NOT NULL,
    last_name               VARCHAR(100)    NOT NULL,
    employee_code           VARCHAR(50)     NULL UNIQUE,
    profile_pic_url         VARCHAR(500)    NULL,
    date_of_joining         DATE            NULL,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    must_change_password    BOOLEAN         NOT NULL DEFAULT TRUE,
    last_login_at           TIMESTAMPTZ     NULL,
    created_by              UUID            NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_pharmacore.login_attempts (
    id                  BIGSERIAL       PRIMARY KEY,
    identifier          VARCHAR(255)    NOT NULL,
    identifier_type     VARCHAR(10)     NOT NULL CHECK (identifier_type IN ('username', 'ip')),
    attempt_count       INT             NOT NULL DEFAULT 1,
    locked_until        TIMESTAMPTZ     NULL,
    last_attempt_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (identifier, identifier_type)
);

CREATE TABLE IF NOT EXISTS tenant_pharmacore.login_audit (
    id                  BIGSERIAL       PRIMARY KEY,
    user_id             UUID            NULL REFERENCES tenant_pharmacore.users(id) ON DELETE SET NULL,
    username_attempted  VARCHAR(100)    NOT NULL,
    event_type          VARCHAR(30)     NOT NULL CHECK (event_type IN ('login_success','login_fail','logout','account_locked','token_refresh')),
    ip_address          INET            NULL,
    user_agent          TEXT            NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_pharmacore.refresh_tokens (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID            NOT NULL REFERENCES tenant_pharmacore.users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255)    NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ     NOT NULL,
    is_revoked      BOOLEAN         NOT NULL DEFAULT FALSE,
    device_info     VARCHAR(255)    NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Indexes for pharmacore
CREATE INDEX IF NOT EXISTS idx_pc_users_username    ON tenant_pharmacore.users (username);
CREATE INDEX IF NOT EXISTS idx_pc_users_active      ON tenant_pharmacore.users (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_pc_login_audit_user  ON tenant_pharmacore.login_audit (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pc_login_audit_event ON tenant_pharmacore.login_audit (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pc_attempts_lookup   ON tenant_pharmacore.login_attempts (identifier, identifier_type);
CREATE INDEX IF NOT EXISTS idx_pc_tokens_hash       ON tenant_pharmacore.refresh_tokens (token_hash);

-- Step 4: Seed all 21 roles
INSERT INTO tenant_pharmacore.roles (role_name, role_group, is_system_role, permissions) VALUES
('System Administrator',            'Admin',           TRUE, '{"batch":"full","equipment":"full","rooms":"full","inventory":"full","quality":"full","reports":"full","users":"full","config":"full","audit":"full"}'),
('User Admin',                      'Admin',           TRUE, '{"batch":"none","equipment":"none","rooms":"none","inventory":"none","quality":"none","reports":"read","users":"full","config":"none","audit":"read"}'),
('Plant of Admin',                  'Admin',           TRUE, '{"batch":"full","equipment":"full","rooms":"full","inventory":"full","quality":"read","reports":"full","users":"read","config":"full","audit":"full"}'),
('Technical Support',               'Admin',           TRUE, '{"batch":"read","equipment":"read","rooms":"read","inventory":"read","quality":"read","reports":"read","users":"read","config":"read","audit":"read"}'),
('Master Data Author',              'Data Management', TRUE, '{"batch":"read","equipment":"read","rooms":"read","inventory":"read","quality":"none","reports":"read","users":"none","config":"full","audit":"read"}'),
('Master Data and Recipe Approver', 'Data Management', TRUE, '{"batch":"full","equipment":"read","rooms":"read","inventory":"read","quality":"read","reports":"full","users":"none","config":"full","audit":"read"}'),
('Recipe Reviewer 1',               'Data Management', TRUE, '{"batch":"read","equipment":"read","rooms":"read","inventory":"none","quality":"read","reports":"read","users":"none","config":"read","audit":"none"}'),
('Recipe Reviewer 2',               'Data Management', TRUE, '{"batch":"read","equipment":"read","rooms":"read","inventory":"none","quality":"read","reports":"read","users":"none","config":"read","audit":"none"}'),
('Recipe and Workflow Author',      'Data Management', TRUE, '{"batch":"full","equipment":"read","rooms":"read","inventory":"read","quality":"none","reports":"read","users":"none","config":"full","audit":"none"}'),
('QA Shop Floor',                   'Quality',         TRUE, '{"batch":"full","equipment":"read","rooms":"full","inventory":"none","quality":"full","reports":"full","users":"none","config":"none","audit":"read"}'),
('Batch Record Review',             'Quality',         TRUE, '{"batch":"read","equipment":"none","rooms":"none","inventory":"none","quality":"full","reports":"full","users":"none","config":"none","audit":"read"}'),
('Order Release Coordinator',       'Quality',         TRUE, '{"batch":"full","equipment":"none","rooms":"none","inventory":"read","quality":"full","reports":"full","users":"none","config":"none","audit":"read"}'),
('Shop Floor Supervisor',           'Operations',      TRUE, '{"batch":"full","equipment":"read","rooms":"full","inventory":"read","quality":"read","reports":"read","users":"none","config":"none","audit":"none"}'),
('Plant Ops Operator',              'Operations',      TRUE, '{"batch":"own","equipment":"read","rooms":"read","inventory":"none","quality":"none","reports":"none","users":"none","config":"none","audit":"none"}'),
('EBR Operator',                    'Operations',      TRUE, '{"batch":"own","equipment":"read","rooms":"read","inventory":"none","quality":"none","reports":"none","users":"none","config":"none","audit":"none"}'),
('Operator',                        'Operations',      TRUE, '{"batch":"own","equipment":"read","rooms":"read","inventory":"none","quality":"none","reports":"none","users":"none","config":"none","audit":"none"}'),
('Cleaning Operator',               'Operations',      TRUE, '{"batch":"none","equipment":"read","rooms":"full","inventory":"none","quality":"none","reports":"none","users":"none","config":"none","audit":"none"}'),
('Display Role',                    'Operations',      TRUE, '{"batch":"read","equipment":"read","rooms":"read","inventory":"read","quality":"read","reports":"read","users":"none","config":"none","audit":"none"}'),
('Maintenance Technician',          'Maintenance',     TRUE, '{"batch":"none","equipment":"full","rooms":"read","inventory":"read","quality":"none","reports":"read","users":"none","config":"none","audit":"none"}'),
('Material Handling Operator',      'Warehouse',       TRUE, '{"batch":"none","equipment":"none","rooms":"none","inventory":"full","quality":"none","reports":"read","users":"none","config":"none","audit":"none"}'),
('Material Handling Supervisor',    'Warehouse',       TRUE, '{"batch":"none","equipment":"none","rooms":"none","inventory":"full","quality":"read","reports":"full","users":"none","config":"none","audit":"none"}'),
('Warehouse Operator',              'Warehouse',       TRUE, '{"batch":"none","equipment":"none","rooms":"none","inventory":"full","quality":"none","reports":"read","users":"none","config":"none","audit":"none"}');

-- Step 5: Seed users (one per role group + a few extras)
-- ALL PASSWORDS = Test@1234
-- bcrypt hash: $2b$12$AC.bY.rX2mAJV1zVKcphGuAdtRZiqHnaZWlIvNM1w4gIQ4tAMDseC

INSERT INTO tenant_pharmacore.users (
    company_id, role_id, username, email, password_hash,
    first_name, last_name, employee_code, date_of_joining,
    is_active, must_change_password
) VALUES

-- System Administrator
(
    'a1b2c3d4-0001-0001-0001-000000000001',
    (SELECT id FROM tenant_pharmacore.roles WHERE role_name = 'System Administrator'),
    'sysadmin', 'sysadmin@pharmacorelabs.com',
    '$2b$12$AC.bY.rX2mAJV1zVKcphGuAdtRZiqHnaZWlIvNM1w4gIQ4tAMDseC',
    'System', 'Admin', 'EMP-PC-001', '2023-01-01', TRUE, FALSE
),

-- User Admin
(
    'a1b2c3d4-0001-0001-0001-000000000001',
    (SELECT id FROM tenant_pharmacore.roles WHERE role_name = 'User Admin'),
    'useradmin', 'useradmin@pharmacorelabs.com',
    '$2b$12$AC.bY.rX2mAJV1zVKcphGuAdtRZiqHnaZWlIvNM1w4gIQ4tAMDseC',
    'Ravi', 'Sharma', 'EMP-PC-002', '2023-02-15', TRUE, FALSE
),

-- QA Shop Floor
(
    'a1b2c3d4-0001-0001-0001-000000000001',
    (SELECT id FROM tenant_pharmacore.roles WHERE role_name = 'QA Shop Floor'),
    'qa_priya', 'priya.qa@pharmacorelabs.com',
    '$2b$12$AC.bY.rX2mAJV1zVKcphGuAdtRZiqHnaZWlIvNM1w4gIQ4tAMDseC',
    'Priya', 'Nair', 'EMP-PC-003', '2023-03-10', TRUE, FALSE
),

-- Batch Record Review
(
    'a1b2c3d4-0001-0001-0001-000000000001',
    (SELECT id FROM tenant_pharmacore.roles WHERE role_name = 'Batch Record Review'),
    'batch_reviewer', 'batch.review@pharmacorelabs.com',
    '$2b$12$AC.bY.rX2mAJV1zVKcphGuAdtRZiqHnaZWlIvNM1w4gIQ4tAMDseC',
    'Amit', 'Desai', 'EMP-PC-004', '2023-04-01', TRUE, FALSE
),

-- Shop Floor Supervisor
(
    'a1b2c3d4-0001-0001-0001-000000000001',
    (SELECT id FROM tenant_pharmacore.roles WHERE role_name = 'Shop Floor Supervisor'),
    'supervisor_raj', 'raj.supervisor@pharmacorelabs.com',
    '$2b$12$AC.bY.rX2mAJV1zVKcphGuAdtRZiqHnaZWlIvNM1w4gIQ4tAMDseC',
    'Rajesh', 'Kumar', 'EMP-PC-005', '2022-11-20', TRUE, FALSE
),

-- EBR Operator
(
    'a1b2c3d4-0001-0001-0001-000000000001',
    (SELECT id FROM tenant_pharmacore.roles WHERE role_name = 'EBR Operator'),
    'ebr_sneha', 'sneha.ebr@pharmacorelabs.com',
    '$2b$12$AC.bY.rX2mAJV1zVKcphGuAdtRZiqHnaZWlIvNM1w4gIQ4tAMDseC',
    'Sneha', 'Patil', 'EMP-PC-006', '2023-06-01', TRUE, FALSE
),

-- Cleaning Operator
(
    'a1b2c3d4-0001-0001-0001-000000000001',
    (SELECT id FROM tenant_pharmacore.roles WHERE role_name = 'Cleaning Operator'),
    'cleaning_arjun', 'arjun.clean@pharmacorelabs.com',
    '$2b$12$AC.bY.rX2mAJV1zVKcphGuAdtRZiqHnaZWlIvNM1w4gIQ4tAMDseC',
    'Arjun', 'Mehta', 'EMP-PC-007', '2023-07-15', TRUE, FALSE
),

-- Maintenance Technician
(
    'a1b2c3d4-0001-0001-0001-000000000001',
    (SELECT id FROM tenant_pharmacore.roles WHERE role_name = 'Maintenance Technician'),
    'maint_vikram', 'vikram.maint@pharmacorelabs.com',
    '$2b$12$AC.bY.rX2mAJV1zVKcphGuAdtRZiqHnaZWlIvNM1w4gIQ4tAMDseC',
    'Vikram', 'Singh', 'EMP-PC-008', '2022-09-01', TRUE, FALSE
),

-- Warehouse Operator
(
    'a1b2c3d4-0001-0001-0001-000000000001',
    (SELECT id FROM tenant_pharmacore.roles WHERE role_name = 'Warehouse Operator'),
    'warehouse_deepa', 'deepa.warehouse@pharmacorelabs.com',
    '$2b$12$AC.bY.rX2mAJV1zVKcphGuAdtRZiqHnaZWlIvNM1w4gIQ4tAMDseC',
    'Deepa', 'Joshi', 'EMP-PC-009', '2023-08-20', TRUE, FALSE
),

-- Master Data Author
(
    'a1b2c3d4-0001-0001-0001-000000000001',
    (SELECT id FROM tenant_pharmacore.roles WHERE role_name = 'Master Data Author'),
    'data_author', 'data.author@pharmacorelabs.com',
    '$2b$12$AC.bY.rX2mAJV1zVKcphGuAdtRZiqHnaZWlIvNM1w4gIQ4tAMDseC',
    'Neha', 'Verma', 'EMP-PC-010', '2023-05-10', TRUE, FALSE
);

-- Step 6: Seed some dummy login audit records for pharmacore
INSERT INTO tenant_pharmacore.login_audit
    (user_id, username_attempted, event_type, ip_address, user_agent, created_at)
VALUES
(
    (SELECT id FROM tenant_pharmacore.users WHERE username = 'sysadmin'),
    'sysadmin', 'login_success', '192.168.1.10',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    NOW() - INTERVAL '2 days'
),
(
    (SELECT id FROM tenant_pharmacore.users WHERE username = 'qa_priya'),
    'qa_priya', 'login_success', '192.168.1.22',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/537.36',
    NOW() - INTERVAL '1 day'
),
(
    NULL,
    'unknown_hacker', 'login_fail', '45.33.32.156',
    'python-requests/2.28.0',
    NOW() - INTERVAL '6 hours'
),
(
    (SELECT id FROM tenant_pharmacore.users WHERE username = 'sysadmin'),
    'sysadmin', 'login_fail', '192.168.1.10',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    NOW() - INTERVAL '3 hours'
),
(
    (SELECT id FROM tenant_pharmacore.users WHERE username = 'sysadmin'),
    'sysadmin', 'login_success', '192.168.1.10',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    NOW() - INTERVAL '2 hours'
),
(
    (SELECT id FROM tenant_pharmacore.users WHERE username = 'supervisor_raj'),
    'supervisor_raj', 'logout', '192.168.1.45',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1',
    NOW() - INTERVAL '30 minutes'
);


-- ============================================================
-- COMPANY 2 — MedSync Industries
-- ============================================================

INSERT INTO public.companies (
    id,
    company_code,
    company_name,
    schema_name,
    logo_url,
    contact_email,
    is_active
) VALUES (
    'b2c3d4e5-0002-0002-0002-000000000002',
    'medsync',
    'MedSync Industries Ltd.',
    'tenant_medsync',
    NULL,
    'admin@medsyncindustries.com',
    TRUE
);

CREATE SCHEMA IF NOT EXISTS tenant_medsync;

CREATE TABLE IF NOT EXISTS tenant_medsync.roles (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name           VARCHAR(100)    NOT NULL UNIQUE,
    role_group          VARCHAR(50)     NULL,
    permissions         JSONB           NOT NULL DEFAULT '{}',
    is_system_role      BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_by          UUID            NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_medsync.users (
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id              UUID            NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    role_id                 UUID            NOT NULL REFERENCES tenant_medsync.roles(id) ON DELETE RESTRICT,
    username                VARCHAR(100)    NOT NULL UNIQUE,
    email                   VARCHAR(255)    NOT NULL UNIQUE,
    password_hash           VARCHAR(255)    NOT NULL,
    first_name              VARCHAR(100)    NOT NULL,
    last_name               VARCHAR(100)    NOT NULL,
    employee_code           VARCHAR(50)     NULL UNIQUE,
    profile_pic_url         VARCHAR(500)    NULL,
    date_of_joining         DATE            NULL,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    must_change_password    BOOLEAN         NOT NULL DEFAULT TRUE,
    last_login_at           TIMESTAMPTZ     NULL,
    created_by              UUID            NULL REFERENCES tenant_medsync.users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_medsync.login_attempts (
    id                  BIGSERIAL       PRIMARY KEY,
    identifier          VARCHAR(255)    NOT NULL,
    identifier_type     VARCHAR(10)     NOT NULL CHECK (identifier_type IN ('username', 'ip')),
    attempt_count       INT             NOT NULL DEFAULT 1,
    locked_until        TIMESTAMPTZ     NULL,
    last_attempt_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (identifier, identifier_type)
);

CREATE TABLE IF NOT EXISTS tenant_medsync.login_audit (
    id                  BIGSERIAL       PRIMARY KEY,
    user_id             UUID            NULL REFERENCES tenant_medsync.users(id) ON DELETE SET NULL,
    username_attempted  VARCHAR(100)    NOT NULL,
    event_type          VARCHAR(30)     NOT NULL CHECK (event_type IN ('login_success','login_fail','logout','account_locked','token_refresh')),
    ip_address          INET            NULL,
    user_agent          TEXT            NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_medsync.refresh_tokens (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID            NOT NULL REFERENCES tenant_medsync.users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255)    NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ     NOT NULL,
    is_revoked      BOOLEAN         NOT NULL DEFAULT FALSE,
    device_info     VARCHAR(255)    NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Indexes for medsync
CREATE INDEX IF NOT EXISTS idx_ms_users_username    ON tenant_medsync.users (username);
CREATE INDEX IF NOT EXISTS idx_ms_users_active      ON tenant_medsync.users (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ms_login_audit_user  ON tenant_medsync.login_audit (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ms_login_audit_event ON tenant_medsync.login_audit (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ms_attempts_lookup   ON tenant_medsync.login_attempts (identifier, identifier_type);
CREATE INDEX IF NOT EXISTS idx_ms_tokens_hash       ON tenant_medsync.refresh_tokens (token_hash);

-- Seed roles for medsync
INSERT INTO tenant_medsync.roles (role_name, role_group, is_system_role, permissions) VALUES
('System Administrator',            'Admin',           TRUE, '{"batch":"full","equipment":"full","rooms":"full","inventory":"full","quality":"full","reports":"full","users":"full","config":"full","audit":"full"}'),
('User Admin',                      'Admin',           TRUE, '{"batch":"none","equipment":"none","rooms":"none","inventory":"none","quality":"none","reports":"read","users":"full","config":"none","audit":"read"}'),
('Plant of Admin',                  'Admin',           TRUE, '{"batch":"full","equipment":"full","rooms":"full","inventory":"full","quality":"read","reports":"full","users":"read","config":"full","audit":"full"}'),
('Technical Support',               'Admin',           TRUE, '{"batch":"read","equipment":"read","rooms":"read","inventory":"read","quality":"read","reports":"read","users":"read","config":"read","audit":"read"}'),
('Master Data Author',              'Data Management', TRUE, '{"batch":"read","equipment":"read","rooms":"read","inventory":"read","quality":"none","reports":"read","users":"none","config":"full","audit":"read"}'),
('Master Data and Recipe Approver', 'Data Management', TRUE, '{"batch":"full","equipment":"read","rooms":"read","inventory":"read","quality":"read","reports":"full","users":"none","config":"full","audit":"read"}'),
('Recipe Reviewer 1',               'Data Management', TRUE, '{"batch":"read","equipment":"read","rooms":"read","inventory":"none","quality":"read","reports":"read","users":"none","config":"read","audit":"none"}'),
('Recipe Reviewer 2',               'Data Management', TRUE, '{"batch":"read","equipment":"read","rooms":"read","inventory":"none","quality":"read","reports":"read","users":"none","config":"read","audit":"none"}'),
('Recipe and Workflow Author',      'Data Management', TRUE, '{"batch":"full","equipment":"read","rooms":"read","inventory":"read","quality":"none","reports":"read","users":"none","config":"full","audit":"none"}'),
('QA Shop Floor',                   'Quality',         TRUE, '{"batch":"full","equipment":"read","rooms":"full","inventory":"none","quality":"full","reports":"full","users":"none","config":"none","audit":"read"}'),
('Batch Record Review',             'Quality',         TRUE, '{"batch":"read","equipment":"none","rooms":"none","inventory":"none","quality":"full","reports":"full","users":"none","config":"none","audit":"read"}'),
('Order Release Coordinator',       'Quality',         TRUE, '{"batch":"full","equipment":"none","rooms":"none","inventory":"read","quality":"full","reports":"full","users":"none","config":"none","audit":"read"}'),
('Shop Floor Supervisor',           'Operations',      TRUE, '{"batch":"full","equipment":"read","rooms":"full","inventory":"read","quality":"read","reports":"read","users":"none","config":"none","audit":"none"}'),
('Plant Ops Operator',              'Operations',      TRUE, '{"batch":"own","equipment":"read","rooms":"read","inventory":"none","quality":"none","reports":"none","users":"none","config":"none","audit":"none"}'),
('EBR Operator',                    'Operations',      TRUE, '{"batch":"own","equipment":"read","rooms":"read","inventory":"none","quality":"none","reports":"none","users":"none","config":"none","audit":"none"}'),
('Operator',                        'Operations',      TRUE, '{"batch":"own","equipment":"read","rooms":"read","inventory":"none","quality":"none","reports":"none","users":"none","config":"none","audit":"none"}'),
('Cleaning Operator',               'Operations',      TRUE, '{"batch":"none","equipment":"read","rooms":"full","inventory":"none","quality":"none","reports":"none","users":"none","config":"none","audit":"none"}'),
('Display Role',                    'Operations',      TRUE, '{"batch":"read","equipment":"read","rooms":"read","inventory":"read","quality":"read","reports":"read","users":"none","config":"none","audit":"none"}'),
('Maintenance Technician',          'Maintenance',     TRUE, '{"batch":"none","equipment":"full","rooms":"read","inventory":"read","quality":"none","reports":"read","users":"none","config":"none","audit":"none"}'),
('Material Handling Operator',      'Warehouse',       TRUE, '{"batch":"none","equipment":"none","rooms":"none","inventory":"full","quality":"none","reports":"read","users":"none","config":"none","audit":"none"}'),
('Material Handling Supervisor',    'Warehouse',       TRUE, '{"batch":"none","equipment":"none","rooms":"none","inventory":"full","quality":"read","reports":"full","users":"none","config":"none","audit":"none"}'),
('Warehouse Operator',              'Warehouse',       TRUE, '{"batch":"none","equipment":"none","rooms":"none","inventory":"full","quality":"none","reports":"read","users":"none","config":"none","audit":"none"}');

-- Seed users for medsync
INSERT INTO tenant_medsync.users (
    company_id, role_id, username, email, password_hash,
    first_name, last_name, employee_code, date_of_joining,
    is_active, must_change_password
) VALUES
(
    'b2c3d4e5-0002-0002-0002-000000000002',
    (SELECT id FROM tenant_medsync.roles WHERE role_name = 'System Administrator'),
    'sysadmin', 'sysadmin@medsyncindustries.com',
    '$2b$12$AC.bY.rX2mAJV1zVKcphGuAdtRZiqHnaZWlIvNM1w4gIQ4tAMDseC',
    'System', 'Admin', 'EMP-MS-001', '2022-06-01', TRUE, FALSE
),
(
    'b2c3d4e5-0002-0002-0002-000000000002',
    (SELECT id FROM tenant_medsync.roles WHERE role_name = 'QA Shop Floor'),
    'qa_anita', 'anita.qa@medsyncindustries.com',
    '$2b$12$AC.bY.rX2mAJV1zVKcphGuAdtRZiqHnaZWlIvNM1w4gIQ4tAMDseC',
    'Anita', 'Rao', 'EMP-MS-002', '2022-09-15', TRUE, FALSE
),
(
    'b2c3d4e5-0002-0002-0002-000000000002',
    (SELECT id FROM tenant_medsync.roles WHERE role_name = 'Shop Floor Supervisor'),
    'supervisor_kiran', 'kiran.sup@medsyncindustries.com',
    '$2b$12$AC.bY.rX2mAJV1zVKcphGuAdtRZiqHnaZWlIvNM1w4gIQ4tAMDseC',
    'Kiran', 'Bhat', 'EMP-MS-003', '2022-12-01', TRUE, FALSE
),
(
    'b2c3d4e5-0002-0002-0002-000000000002',
    (SELECT id FROM tenant_medsync.roles WHERE role_name = 'Operator'),
    'operator_suresh', 'suresh.op@medsyncindustries.com',
    '$2b$12$AC.bY.rX2mAJV1zVKcphGuAdtRZiqHnaZWlIvNM1w4gIQ4tAMDseC',
    'Suresh', 'Pillai', 'EMP-MS-004', '2023-01-10', TRUE, FALSE
),
(
    'b2c3d4e5-0002-0002-0002-000000000002',
    (SELECT id FROM tenant_medsync.roles WHERE role_name = 'Maintenance Technician'),
    'maint_gopal', 'gopal.maint@medsyncindustries.com',
    '$2b$12$AC.bY.rX2mAJV1zVKcphGuAdtRZiqHnaZWlIvNM1w4gIQ4tAMDseC',
    'Gopal', 'Nair', 'EMP-MS-005', '2023-03-20', TRUE, FALSE
);


-- ============================================================
-- VERIFICATION QUERIES
-- Run these after seeding to confirm everything is correct
-- ============================================================

-- Check companies
SELECT
    company_code,
    company_name,
    schema_name,
    is_active
FROM public.companies
ORDER BY created_at;

-- Check pharmacore users with their roles
SELECT
    u.username,
    u.first_name || ' ' || u.last_name   AS full_name,
    u.email,
    r.role_name,
    r.role_group,
    u.is_active,
    u.must_change_password
FROM tenant_pharmacore.users u
JOIN tenant_pharmacore.roles r ON r.id = u.role_id
ORDER BY r.role_group, u.username;

-- Check medsync users with their roles
SELECT
    u.username,
    u.first_name || ' ' || u.last_name   AS full_name,
    u.email,
    r.role_name,
    r.role_group,
    u.is_active
FROM tenant_medsync.users u
JOIN tenant_medsync.roles r ON r.id = u.role_id
ORDER BY r.role_group, u.username;

-- Check pharmacore audit log entries
SELECT
    username_attempted,
    event_type,
    ip_address,
    created_at
FROM tenant_pharmacore.login_audit
ORDER BY created_at DESC;

-- Quick sanity check — role count per company
SELECT 'pharmacore roles' AS label, COUNT(*) FROM tenant_pharmacore.roles
UNION ALL
SELECT 'medsync roles',             COUNT(*) FROM tenant_medsync.roles
UNION ALL
SELECT 'pharmacore users',          COUNT(*) FROM tenant_pharmacore.users
UNION ALL
SELECT 'medsync users',             COUNT(*) FROM tenant_medsync.users;

-- ============================================================
-- SUMMARY OF TEST CREDENTIALS
--
-- COMPANY 1 — PharmaCore Labs
--   Login URL company code : pharmacore
--   ┌─────────────────┬──────────────┬───────────────────────────────────────┐
--   │ Username        │ Password     │ Role                                  │
--   ├─────────────────┼──────────────┼───────────────────────────────────────┤
--   │ sysadmin        │ Test@1234    │ System Administrator (full access)    │
--   │ useradmin       │ Test@1234    │ User Admin                            │
--   │ qa_priya        │ Test@1234    │ QA Shop Floor                         │
--   │ batch_reviewer  │ Test@1234    │ Batch Record Review                   │
--   │ supervisor_raj  │ Test@1234    │ Shop Floor Supervisor                 │
--   │ ebr_sneha       │ Test@1234    │ EBR Operator                          │
--   │ cleaning_arjun  │ Test@1234    │ Cleaning Operator                     │
--   │ maint_vikram    │ Test@1234    │ Maintenance Technician                │
--   │ warehouse_deepa │ Test@1234    │ Warehouse Operator                    │
--   │ data_author     │ Test@1234    │ Master Data Author                    │
--   └─────────────────┴──────────────┴───────────────────────────────────────┘
--
-- COMPANY 2 — MedSync Industries
--   Login URL company code : medsync
--   ┌──────────────────┬──────────────┬───────────────────────────────────────┐
--   │ Username         │ Password     │ Role                                  │
--   ├──────────────────┼──────────────┼───────────────────────────────────────┤
--   │ sysadmin         │ Test@1234    │ System Administrator (full access)    │
--   │ qa_anita         │ Test@1234    │ QA Shop Floor                         │
--   │ supervisor_kiran │ Test@1234    │ Shop Floor Supervisor                 │
--   │ operator_suresh  │ Test@1234    │ Operator                              │
--   │ maint_gopal      │ Test@1234    │ Maintenance Technician                │
--   └──────────────────┴──────────────┴───────────────────────────────────────┘
--
-- NOTE: must_change_password = FALSE for all seed users
--       so you can log in directly without being redirected
-- ============================================================
