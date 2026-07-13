# Digilog — Test Credentials

All seed users have `must_change_password = FALSE` so login goes directly to the dashboard.

---

## Company 1 — PharmaCore Labs

**Company Code:** `pharmacore`

| Username | Password | Role | Permissions Summary |
|----------|----------|------|---------------------|
| `sysadmin` | `Test@1234` | System Administrator | Full access to all modules |
| `useradmin` | `Test@1234` | User Admin | Users (full), reports (read) |
| `qa_priya` | `Test@1234` | QA Shop Floor | Batch (full), rooms (full), quality (full), reports (full) |
| `batch_reviewer` | `Test@1234` | Batch Record Review | Batch (read), quality (full), reports (full) |
| `supervisor_raj` | `Test@1234` | Shop Floor Supervisor | Batch (full), rooms (full), equipment (read), inventory (read) |
| `ebr_sneha` | `Test@1234` | EBR Operator | Batch (own records only) |
| `cleaning_arjun` | `Test@1234` | Cleaning Operator | Rooms (full) |
| `maint_vikram` | `Test@1234` | Maintenance Technician | Equipment (full), inventory (read), reports (read) |
| `warehouse_deepa` | `Test@1234` | Warehouse Operator | Inventory (full), reports (read) |
| `data_author` | `Test@1234` | Master Data Author | Config (full), read-only on most modules |

---

## Company 2 — MedSync Industries

**Company Code:** `medsync`

| Username | Password | Role | Permissions Summary |
|----------|----------|------|---------------------|
| `sysadmin` | `Test@1234` | System Administrator | Full access to all modules |
| `qa_anita` | `Test@1234` | QA Shop Floor | Batch (full), rooms (full), quality (full), reports (full) |
| `supervisor_kiran` | `Test@1234` | Shop Floor Supervisor | Batch (full), rooms (full), equipment (read) |
| `operator_suresh` | `Test@1234` | Operator | Batch (own records only) |
| `maint_gopal` | `Test@1234` | Maintenance Technician | Equipment (full), inventory (read), reports (read) |

---

## Permission Levels

| Value | Meaning |
|-------|---------|
| `full` | Create, read, update, delete |
| `read` | View only |
| `own` | Can only access their own records |
| `none` | No access |

---

## Permission Modules

| Module | Description |
|--------|-------------|
| `batch` | Batch records and manufacturing orders |
| `equipment` | Equipment management and maintenance |
| `rooms` | Cleanroom and facility management |
| `inventory` | Materials and stock management |
| `quality` | QA workflows and approvals |
| `reports` | Reporting and analytics |
| `users` | User management |
| `config` | Master data and system configuration |
| `audit` | Audit log access |

---

## Interesting Test Scenarios

### 1. Multi-tenant isolation
- Login as `sysadmin` on `pharmacore` → see pharmacore data
- Logout → login as `sysadmin` on `medsync` → completely separate data

### 2. Middleware permission gates
- Login as `cleaning_arjun` (`pharmacore`) — only has rooms access
- Try navigating to `/quality` or `/admin` → should be blocked/redirected

### 3. Most restricted user
- Login as `operator_suresh` (`medsync`) — `batch: own` only
- Cannot access quality, equipment, reports, config, etc.

### 4. Read-only user
- Login as `batch_reviewer` (`pharmacore`) — can view batch + quality but not modify

### 5. Admin vs User Admin
- `sysadmin` — full system access including config and audit
- `useradmin` — can only manage users, cannot touch batch or equipment

---

## Login URL

```
http://localhost:3000/login
```
