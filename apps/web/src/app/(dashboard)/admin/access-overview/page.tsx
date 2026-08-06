"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/useAuth"
import {
  apiGetRoles,
  apiGetUsers,
  type RoleItem,
  type UserListItem,
  ApiError,
} from "@/lib/auth/api"
import {
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Loader2,
  Users,
  KeyRound,
  CheckCircle2,
  XCircle,
  Eye,
  UserCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Permission key → human label mapping ──────────────────────────────────────

const PERM_LABELS: Record<string, { label: string; description: string }> = {
  users:     { label: "User Management",        description: "Create, edit, deactivate users" },
  audit:     { label: "Audit Logs",             description: "View system audit trail" },
  config:    { label: "Configuration",          description: "System settings & master data" },
  quality:   { label: "Quality Operations",     description: "Quality checks & inspections" },
  batch:     { label: "Batch / Operations",     description: "Batch processing & operations" },
  rooms:     { label: "Room Management",        description: "Room cleaning, inspection & QAC" },
  equipment: { label: "Equipment Maintenance",  description: "Equipment maintenance & SOPs" },
  inventory: { label: "Warehouse / Inventory",  description: "Inventory & warehouse operations" },
}

const PERM_KEY_ORDER = ["users", "audit", "config", "quality", "batch", "rooms", "equipment", "inventory"]

// ── Badge components ──────────────────────────────────────────────────────────

function PermBadge({ value }: { value: string | undefined }) {
  if (!value || value === "none") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <XCircle className="size-3" />
        No Access
      </span>
    )
  }
  if (value === "full") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800">
        <CheckCircle2 className="size-3" />
        Full
      </span>
    )
  }
  if (value === "read") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800">
        <Eye className="size-3" />
        Read
      </span>
    )
  }
  if (value === "own") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800">
        <UserCheck className="size-3" />
        Own
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {value}
    </span>
  )
}

function RoleBadge({ roleName }: { roleName: string }) {
  const colors: Record<string, string> = {
    "System Administrator": "bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:ring-purple-800",
    "User Admin":           "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800",
    "Warehouse Operator":   "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:ring-orange-800",
    "Cleaning Operator":    "bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:ring-teal-800",
    "Maintenance Technician": "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-800",
  }
  const cls = colors[roleName] ?? "bg-muted text-muted-foreground ring-border"
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1", cls)}>
      {roleName}
    </span>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getPermissionsForRole(role: RoleItem): Record<string, string> {
  if (!role.permissions || typeof role.permissions !== "object") return {}
  return role.permissions as Record<string, string>
}

function getAccessibleFeatures(perms: Record<string, string>): string[] {
  return PERM_KEY_ORDER
    .filter((key) => perms[key] && perms[key] !== "none")
    .map((key) => PERM_LABELS[key]?.label ?? key)
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AccessOverviewPage() {
  const router   = useRouter()
  const { user, getAccessToken } = useAuth()

  const [roles,     setRoles]     = useState<RoleItem[]>([])
  const [users,     setUsers]     = useState<UserListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<{ code: string; message: string } | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)

  // ── Guard: only System Administrator ───────────────────────────────────────
  useEffect(() => {
    if (user && user.role !== "System Administrator") {
      router.replace("/admin")
    }
  }, [user, router])

  // ── Fetch roles + users in parallel ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function load() {
      const token = getAccessToken()
      if (!token) {
        setError({ code: "MISSING_TOKEN", message: "No access token available. Please log in again." })
        setIsLoading(false)
        return
      }

      try {
        const [rolesData, usersData] = await Promise.all([
          apiGetRoles(token),
          apiGetUsers(token),
        ])
        if (!cancelled) {
          setRoles(rolesData)
          setUsers(usersData)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError({ code: err.code, message: err.message })
          } else {
            setError({ code: "UNKNOWN", message: "An unexpected error occurred." })
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [getAccessToken])

  // ── Guard redirect (non-admin) ─────────────────────────────────────────────
  if (user && user.role !== "System Administrator") {
    return null
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader />
        <div className="flex items-center justify-center rounded-xl border bg-card p-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader />
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-16 text-center">
          {error.code === "FORBIDDEN" ? (
            <ShieldAlert className="size-8 text-destructive" />
          ) : (
            <AlertCircle className="size-8 text-destructive" />
          )}
          <p className="font-medium">
            {error.code === "FORBIDDEN" ? "Access Denied" : "Failed to load data"}
          </p>
          <p className="text-sm text-muted-foreground max-w-sm">{error.message}</p>
        </div>
      </div>
    )
  }

  // ── Collect all permission keys present across all roles ───────────────────
  const permKeys = PERM_KEY_ORDER.filter((key) =>
    roles.some((r) => {
      const p = getPermissionsForRole(r)
      return key in p
    }),
  )

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-8">
      <PageHeader />

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Permission Levels</p>
        <div className="flex flex-wrap gap-3">
          <PermBadge value="full" />
          <span className="text-xs text-muted-foreground self-center">Full read + write access</span>
          <span className="text-muted-foreground">·</span>
          <PermBadge value="read" />
          <span className="text-xs text-muted-foreground self-center">Read-only access</span>
          <span className="text-muted-foreground">·</span>
          <PermBadge value="own" />
          <span className="text-xs text-muted-foreground self-center">Own records only</span>
          <span className="text-muted-foreground">·</span>
          <PermBadge value="none" />
          <span className="text-xs text-muted-foreground self-center">No access</span>
        </div>
      </div>

      {/* ── Role permissions matrix ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          <h2 className="text-base font-semibold">Role Permissions Matrix</h2>
        </div>
        <p className="text-sm text-muted-foreground -mt-1">
          Each role&apos;s access level per functional area of the system.
        </p>

        {/* ── Role Selector ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 py-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Filter by Role:
          </span>
          <button
            onClick={() => setSelectedRoleId(null)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              selectedRoleId === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            All Roles
          </button>
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRoleId(role.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                selectedRoleId === role.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {role.roleName}
            </button>
          ))}
        </div>

        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-56">
                  Functional Area
                </th>
                {selectedRoleId === null ? (
                  roles.map((role) => (
                    <th key={role.id} className="text-center px-3 py-3 font-medium">
                      <RoleBadge roleName={role.roleName} />
                    </th>
                  ))
                ) : (
                  <th className="text-center px-3 py-3 font-medium">
                    <RoleBadge roleName={roles.find((r) => r.id === selectedRoleId)?.roleName || "Role"} />
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {permKeys.map((key, idx) => {
                const info = PERM_LABELS[key]
                return (
                  <tr
                    key={key}
                    className={cn(
                      "border-b last:border-0 transition-colors hover:bg-muted/30",
                      idx % 2 === 0 ? "bg-background" : "bg-muted/10",
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{info?.label ?? key}</p>
                      {info?.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
                      )}
                    </td>
                    {selectedRoleId === null ? (
                      roles.map((role) => {
                        const perms = getPermissionsForRole(role)
                        const val   = perms[key] ?? "none"
                        return (
                          <td key={role.id} className="text-center px-3 py-3">
                            <PermBadge value={val} />
                          </td>
                        )
                      })
                    ) : (
                      <td className="text-center px-3 py-3">
                        {(() => {
                          const selectedRole = roles.find((r) => r.id === selectedRoleId)
                          if (!selectedRole) return null
                          const perms = getPermissionsForRole(selectedRole)
                          const val   = perms[key] ?? "none"
                          return <PermBadge value={val} />
                        })()}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Per-role summary cards ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <h2 className="text-base font-semibold">Role Access Summary</h2>
        </div>
        <p className="text-sm text-muted-foreground -mt-1">
          Overview of what each role can access across the system.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.map((role) => {
            const perms     = getPermissionsForRole(role)
            const features  = getAccessibleFeatures(perms)
            const userCount = users.filter((u) => u.role.roleName === role.roleName && u.isActive).length
            const totalUsers = users.filter((u) => u.role.roleName === role.roleName).length

            return (
              <div key={role.id} className="rounded-xl border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <RoleBadge roleName={role.roleName} />
                  <span className="text-xs text-muted-foreground shrink-0">
                    {userCount} active / {totalUsers} total
                  </span>
                </div>

                {features.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {PERM_KEY_ORDER.filter((k) => perms[k] && perms[k] !== "none").map((k) => (
                      <li key={k} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">{PERM_LABELS[k]?.label ?? k}</span>
                        <PermBadge value={perms[k]} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No permissions assigned.</p>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── User access list ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-primary" />
          <h2 className="text-base font-semibold">User Access List</h2>
        </div>
        <p className="text-sm text-muted-foreground -mt-1">
          Every user in the system, their assigned role, and the functional areas they can access.
        </p>

        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Username</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Accessible Features</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => {
                const matchedRole = roles.find((r) => r.id === u.role.id)
                const perms       = matchedRole ? getPermissionsForRole(matchedRole) : {}
                const features    = getAccessibleFeatures(perms)

                return (
                  <tr
                    key={u.id}
                    className={cn(
                      "border-b last:border-0 transition-colors hover:bg-muted/30",
                      idx % 2 === 0 ? "bg-background" : "bg-muted/10",
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.username}</td>
                    <td className="px-4 py-3">
                      <RoleBadge roleName={u.role.roleName} />
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800">
                          <CheckCircle2 className="size-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-800">
                          <XCircle className="size-3" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {features.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {features.map((f) => (
                            <span
                              key={f}
                              className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No access</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

// ── Page header ────────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
        <ShieldCheck className="size-5 text-primary" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Access Overview</h1>
        <p className="text-sm text-muted-foreground">
          Role-based access control — see exactly what each role and user can access.
        </p>
      </div>
    </div>
  )
}
