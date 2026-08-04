# Room Maintenance Workflow

## Overview

The room maintenance module implements a role-gated, approval-based workflow for managing room maintenance in the Digilog system. When a maintenance request is created, the room is immediately blocked from use until the work is completed or the request is rejected.

---

## Roles Involved

| Role | Responsibilities |
|------|-----------------|
| **User Admin** | Creates maintenance requests. Receives notification when work is completed. |
| **System Administrator** | Receives notification of new requests. Approves or rejects them. |
| **Cleaning Operator** | Sees approved requests. Starts and stops maintenance work. |

---

## Complete Workflow

```
User Admin
  │
  ▼
Creates maintenance request
  • Room is BLOCKED immediately (status → under_maintenance)
  • Maintenance log created (status: scheduled, authorizationStatus: pending)
  • System Administrator receives in-app notification
  │
  ▼
System Administrator
  ├─── REJECTS ───▶ Maintenance log cancelled, room restored to ACTIVE
  │
  └─── APPROVES ──▶ authorizationStatus → approved
                      Record becomes visible to Cleaning Operator
                      │
                      ▼
                    Cleaning Operator
                      │
                      ▼
                    Clicks START MAINTENANCE
                      • Actual start time recorded in DB
                      • Maintenance log status → active
                      │
                      ▼
                    Work is done → Clicks STOP MAINTENANCE
                      • Stop time recorded, duration calculated
                      • Maintenance log status → stopped
                      • Room restored to ACTIVE
                      • User Admin receives in-app notification
```

---

## Status & Authorization Values

### Maintenance Log Status (`status`)

| Value | Meaning |
|-------|---------|
| `scheduled` | Request created, awaiting approval or start |
| `active` | Cleaning Operator has started work |
| `stopped` | Work completed, room active again |
| `cancelled` | Rejected by System Administrator |

### Authorization Status (`authorization_status`)

| Value | Meaning |
|-------|---------|
| `pending` | Awaiting System Administrator decision |
| `approved` | System Administrator approved |
| `rejected` | System Administrator rejected |

---

## Role-Based Access Rules

### What each role can do

| Action | User Admin | System Administrator | Cleaning Operator |
|--------|:----------:|:--------------------:|:-----------------:|
| Create maintenance request | ✅ | ❌ | ❌ |
| Approve request | ❌ | ✅ | ❌ |
| Reject request | ❌ | ✅ | ❌ |
| Start maintenance | ❌ | ❌ | ✅ |
| Stop maintenance | ❌ | ❌ | ✅ |

### What each role sees in the table

| Column | User Admin | System Administrator | Cleaning Operator |
|--------|:----------:|:--------------------:|:-----------------:|
| Room ID, Name, Type | ✅ | ✅ | ✅ |
| Status, Approval | ✅ | ✅ | ✅ |
| Start / End Time | ✅ | ✅ | ✅ |
| Requested By | ❌ hidden | ✅ | ✅ |
| Action buttons | ❌ hidden | Approve / Reject | Start / Stop |
| Pending records | ✅ (own requests) | ✅ (all) | ❌ hidden |

---

## In-App Notifications

Notifications appear as a bell icon in the top navigation bar. The badge shows the unread count and refreshes every 30 seconds.

| Event | Who is notified |
|-------|-----------------|
| User Admin creates a maintenance request | All active **System Administrator** users |
| Cleaning Operator stops maintenance | All active **User Admin** users |

---

## Files Changed

### Database
| File | Purpose |
|------|---------|
| `db/in_app_notifications.sql` | Creates the `in_app_notifications` table and index |

### Backend (`apps/api`)
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `InAppNotification` model; linked to `User` |
| `src/services/room-maintenance.service.ts` | Role restrictions on create/approve/reject/stop; new `startMaintenance()`; notifications sent outside transactions; server-side Cleaning Operator filter |
| `src/controllers/room-maintenance.controller.ts` | Added `startMaintenanceController`; passes `userRole` to list service |
| `src/routes/room-maintenance.routes.ts` | Added `POST /:id/start` route |
| `src/services/notification.service.ts` | **New** — list, unread count, mark read, mark all read |
| `src/controllers/notification.controller.ts` | **New** — 4 REST endpoints |
| `src/routes/notification.routes.ts` | **New** — mounted at `/api/notifications` |
| `src/index.ts` | Registered notification router |

### Frontend (`apps/web`)
| File | Change |
|------|--------|
| `src/middleware.ts` | Added `/room/maintenance` route allowing `users` permission so User Admin can access the page |
| `src/lib/auth/api.ts` | Added `apiStartMaintenance`; added `NotificationItem` type and all notification API functions |
| `src/app/(dashboard)/room/maintenance/page.tsx` | Role-based UI: User Admin creates; System Admin approves/rejects; Cleaning Operator starts/stops; Requested By and Action columns hidden for User Admin |
| `src/components/NotificationBell.tsx` | **New** — bell icon with unread badge, dropdown panel, mark-read, polls every 30 seconds |
| `src/app/(dashboard)/layout.tsx` | Added `<NotificationBell />` to the top header |

---

## Deployment Checklist

After pulling changes on any machine:

```bash
# 1. Regenerate Prisma client (required — generated files are not in git)
cd apps/api
npx prisma generate

# 2. Run the DB migration (once per database)
psql -U <user> -d <database> -f db/in_app_notifications.sql

# 3. Restart the API server
npm run dev   # or pm2 restart api

# 4. Rebuild and restart the frontend (production only)
cd apps/web
npm run build
pm2 restart web
```
