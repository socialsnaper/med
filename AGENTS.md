# AGENTS.md — Digilog Pharmaceutical Management System

**Project**: Multi-tenant pharmaceutical operations management system (GMP-compliant)
**Root**: `d:\Simer\med`
**Workspace**: Yarn monorepo (`apps/*`, `packages/*`)

> Read this before working on any part of the project. For frontend-specific rules, also read `apps/web/AGENTS.md`.

---

## 1. Architecture Overview

**Digilog** is a GMP-compliant pharma operations platform. Each customer company gets a fully isolated PostgreSQL schema (schema-per-tenant). The public schema only stores the global `companies` table.

### Tenant Flow
1. Frontend sends `companyCode` + credentials to `/api/auth/login`
2. API looks up company → resolves `schemaName` (e.g. `tenant_pharmacore`)
3. `getPrismaClient(schemaName)` returns a Prisma client scoped to that schema
4. JWT token encodes the tenant context; `verifyToken` middleware extracts it on every request
5. All DB queries are isolated within the tenant schema

---

## 2. Directory Structure

```
d:\Simer\med/
├── apps/
│   ├── api/                          # Express.js + Prisma backend
│   │   ├── src/
│   │   │   ├── index.ts              # Express setup, middleware registration, error handling
│   │   │   ├── controllers/          # HTTP handlers — one file per resource
│   │   │   ├── services/             # Business logic + DB access — one file per resource
│   │   │   ├── routes/               # Express routers — one file per resource
│   │   │   ├── middleware/
│   │   │   │   ├── verifyToken.ts    # requireAccessToken / requirePreAuthToken
│   │   │   │   ├── requireRole.ts    # RBAC: requireRole(['System Administrator'])
│   │   │   │   └── rateLimit.ts      # login/TOTP throttling
│   │   │   ├── types/
│   │   │   │   ├── auth.ts           # JWT payload types
│   │   │   │   └── express.d.ts      # Extends Request with req.user
│   │   │   └── validation/           # Zod schemas for all input payloads
│   │   ├── lib/
│   │   │   └── prisma.ts             # getPrismaClient(schemaName) factory
│   │   ├── prisma/
│   │   │   └── schema.prisma         # Single Prisma schema (all tenant tables)
│   │   ├── generated/prisma/         # Auto-generated Prisma client — DO NOT EDIT
│   │   └── package.json
│   │
│   └── web/                          # Next.js 15 frontend (App Router)
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/           # /login, /2fa, /change-password
│       │   │   └── (dashboard)/      # Protected pages behind auth
│       │   │       ├── layout.tsx    # Sidebar nav + shell (see nav items below)
│       │   │       ├── ProtectedLayout.tsx  # Auth guard
│       │   │       ├── admin/        # /admin — dashboard, users, access-overview, configuration
│       │   │       ├── operations/   # /operations
│       │   │       ├── quality/      # /quality
│       │   │       ├── room/         # /room/maintenance, /room/cleaning
│       │   │       ├── maintenance/  # /maintenance — Equipment Maintenance logs
│       │   │       └── scale/        # /scale/dashboard, /scale/maintenance
│       │   ├── components/
│       │   │   ├── ui/               # shadcn/ui components
│       │   │   └── NotificationBell.tsx
│       │   ├── lib/
│       │   │   ├── auth/
│       │   │   │   ├── api.ts        # All API call functions + TypeScript types
│       │   │   │   └── useAuth.ts    # Auth context hook
│       │   │   └── utils.ts          # cn() utility (clsx + tailwind-merge)
│       │   └── middleware.ts         # Next.js middleware: route auth checks
│       └── package.json
│
├── db/                               # PostgreSQL migration SQL files (run per tenant schema)
│   ├── digilog_seed_company.sql      # Bootstrap public schema + seed companies
│   ├── cleaning_equipment.sql
│   ├── equipment_details.sql
│   ├── equipment_maintenance.sql
│   ├── equipment_maintenance_migrate_to_eqp_details.sql  # ← Run after above two
│   ├── room_type.sql, rooms.sql, room_cleaning_sop.sql   # Room setup
│   ├── equ_cleaning_sop.sql          # Equipment cleaning SOP steps
│   ├── scale.sql, weights.sql
│   ├── function_types.sql, process_type.sql
│   ├── totp_backup_codes.sql, alter_user_table.sql
│   └── *.sql                         # Other migrations
│
├── packages/shared/                  # Shared code (currently minimal)
├── scripts/fix-passwords.js          # Dev utility: reset user passwords
├── package.json                      # Monorepo root
├── tsconfig.base.json
├── start-app.bat                     # Start both api + web in Windows
└── TEST_CREDENTIALS.md               # Test accounts for each role
```

---

## 3. Tech Stack

### Backend (`apps/api`)
| | |
|---|---|
| Runtime | Node.js |
| Framework | Express.js 5 |
| ORM | Prisma 7 |
| Database | PostgreSQL 15+ |
| Auth | jsonwebtoken (JWT) + speakeasy (TOTP 2FA) |
| Validation | Zod 4 |
| Password | bcrypt |
| Security | helmet, cors, express-rate-limit |
| Email | nodemailer |
| Language | TypeScript 6 |

### Frontend (`apps/web`)
| | |
|---|---|
| Framework | Next.js 16 (App Router, `"use client"` pages) |
| UI | React 19 + TailwindCSS 4 + shadcn/ui + Radix UI |
| Icons | lucide-react |
| Forms | react-hook-form 7 + Zod 4 |
| Auth (browser) | jose (JWT) |
| Language | TypeScript 5 |

---

## 4. Left Nav Items (layout.tsx NAV_ITEMS)

```
Dashboard          → /admin          (roles: SysAdmin, UserAdmin, WarehouseOp)
Administration     → children:
  Users            → /admin/users
  Access Overview  → /admin/access-overview
Configuration      → /admin/configuration
Operations         → /operations
Quality            → /quality
Room               → children:
  Maintenance      → /room/maintenance
  Cleaning         → /room/cleaning
Equipment          → children:
  Maintenance      → /maintenance      (Equipment Maintenance logs)
Scale              → children:
  Scale Dashboard  → /scale/dashboard
  Scale Maintenance→ /scale/maintenance
```

Default open groups (sidebar expanded by default): `Administration`, `Room`, `Scale`, `Equipment`

---

## 5. Key Modules

### 5.1 Authentication
- `/api/auth/login` — returns pre-auth token (if 2FA enabled) or full JWT
- `/api/auth/2fa/verify` — verify TOTP code, get full JWT
- `/api/auth/refresh` — refresh access token
- `/api/auth/logout` — revoke refresh token
- JWT payload: `{ id, username, roleName, schemaName, companyCode, ... }`

### 5.2 Equipment Maintenance (`/maintenance`)
- **Equipment source**: `equipment_details` table (NOT `cleaning_equipment`)
- **Workflow**: Create → Approve (SysAdmin) → Start (WarehouseOp/Technician) → Stop → [Approved/Rejected]
- **Key files**:
  - `apps/api/src/services/equipment-maintenance.service.ts`
  - `apps/api/src/controllers/equipment-maintenance.controller.ts`
  - `apps/web/src/app/(dashboard)/maintenance/page.tsx`
- `listEquipment()` queries `db.equipmentDetail.findMany()` and maps `equipmentId` → `equipmentCode`
- Status tracking (`status`, `statusReason`, `currentMaintenanceLogId`) lives on `equipment_details` row

### 5.3 Equipment Details (`/admin/configuration/equipment-details` or similar)
- Table: `equipment_details`
- Fields: `id`, `equipmentId` (human code: EQ-001), `equipmentName`, `equipmentType` (fixed|movable), `serialNo`, `manufacturer`, `supportedProcesses` (JSONB array of process UUIDs), `isActive`, `status`, `statusReason`, `currentMaintenanceLogId`
- API: `GET/POST/PUT/DELETE /api/equipment-details`

### 5.4 Cleaning Equipment
- Separate from Equipment Details — refers to cleaning tools/supplies
- Table: `cleaning_equipment`
- Fields: `equipmentCode`, `equipmentName`, `cleaningType`, `material`, `location`, `manufacturer`, `isActive`
- Note: `status` and `currentMaintenanceLogId` fields still exist on `cleaning_equipment` but are no longer updated by the maintenance module

### 5.5 Room Modules
- Room types defined in `room_types`
- Rooms in `rooms`
- Maintenance logs: `room_maintenance_logs`
- Cleaning/Inspection/QAC SOPs: separate step tables per type

---

## 6. Database Patterns

### Multi-Tenancy
- `getPrismaClient(schemaName)` — returns cached Prisma instance scoped to tenant schema
- All queries execute within that schema automatically
- Never mix tenant schemas in a single query

### Common Field Conventions
| Field | Convention |
|---|---|
| Primary key | `id UUID DEFAULT gen_random_uuid()` |
| Human-readable code | `{resource}_id VARCHAR(20)` e.g. `EQ-001` |
| Audit | `created_by`, `updated_by` (UUID FK → users), `created_at`, `updated_at` |
| Soft delete | `is_active BOOLEAN DEFAULT TRUE` |
| Status | `status VARCHAR(20)` with `active | under_maintenance` etc. |

### Running Migrations
All SQL files in `db/` use `SET search_path TO tenant_pharmacore;` — change as needed for other tenants.

**Order for fresh install:**
1. `digilog_seed_company.sql` (public schema)
2. Core user/role tables (handled in seed)
3. `room_type.sql`, `rooms.sql`
4. `cleaning_equipment.sql`
5. `equipment_details.sql`
6. `equipment_maintenance.sql`
7. `equipment_maintenance_migrate_to_eqp_details.sql` ← changes FK to equipment_details
8. Other domain SQL files

---

## 7. API Conventions

### Route Pattern
```
GET    /api/{resource}           → list
GET    /api/{resource}/:id       → get one
POST   /api/{resource}           → create
PUT    /api/{resource}/:id       → update
DELETE /api/{resource}/:id       → delete
```

### Response Shape
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "message", "code": "ERROR_CODE" }
```

### Middleware Stack (per request)
1. `requireAccessToken` — validates JWT, attaches `req.user`
2. `requireRole([...roles])` — checks RBAC
3. Controller → Service → Prisma

---

## 8. Frontend Conventions

### API Calls
All API functions live in `apps/web/src/lib/auth/api.ts`:
- `apiGet<T>(path, token)` — GET
- `apiPost<T>(path, payload, token)` — POST
- `apiFetch<T>(path, options, token)` — generic
- Throws `ApiError` on non-2xx responses

### Page Pattern
- All dashboard pages are `"use client"` components
- Use `useAuth()` for `{ accessToken, getAccessToken, user }`
- `getAccessToken()` returns live token (refreshes if needed)
- Data fetching in `useEffect` with `useState` for loading/error states

### Auth Context
- `useAuth()` hook provides `{ user, accessToken, getAccessToken, logout }`
- Token stored in memory (not localStorage) + refresh token in httpOnly cookie

---

## 9. Role Reference

| Role | Access Level |
|---|---|
| System Administrator | Full access; approves maintenance, manages users/config |
| User Admin | Creates maintenance requests; manages users |
| Warehouse Operator | Executes maintenance (start/stop); data entry |
| Maintenance Technician | Same as Warehouse Operator for maintenance |
| Cleaning Operator | Room cleaning workflows only |

---

## 10. Dev Commands

```bash
# From workspace root (d:\Simer\med)
yarn                          # Install all workspace dependencies

# Backend
cd apps/api
yarn dev                      # Start API with nodemon (hot reload)
yarn build                    # Compile TypeScript

# Frontend
cd apps/web
yarn dev                      # Start Next.js dev server
yarn build                    # Production build

# Windows: start both at once
start-app.bat
```

---

## 11. Environment Variables

### `apps/api/.env`
```
DATABASE_URL=postgresql://user:pass@localhost:5432/digilog
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_PRE_AUTH_SECRET=...
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

---

## 12. Known Patterns & Gotchas

- **Prisma `as any` casting**: Multi-tenant Prisma uses `as any` for dynamic schema fields not in the generated types. This is intentional.
- **`equipmentId` vs `id`**: On `EquipmentDetail`, `id` is the UUID primary key; `equipmentId` is the human-readable code (EQ-001). When referencing equipment in maintenance logs, use `id`.
- **`equipmentCode` in frontend**: The `EquipmentItem` type (returned by `apiListEquipment`) uses `equipmentCode` — this maps from `EquipmentDetail.equipmentId`.
- **CleaningEquipment.status**: This field still exists in the DB but is no longer updated by the maintenance module (maintenance now tracks `EquipmentDetail.status`).
- **Deferred FK**: `equipment_details.current_maintenance_log_id` uses a deferred FK to `equipment_maintenance_logs.id` to allow creating the log and updating equipment in one transaction.
- **`LOG_SELECT`**: Selects `equipment.equipmentId` (not `equipmentCode`), `equipment.equipmentType` (not `cleaningType`).
