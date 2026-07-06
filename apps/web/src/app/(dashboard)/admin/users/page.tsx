"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/lib/auth/useAuth"
import { apiGetUsers, apiExportUsers, type UserListItem, ApiError } from "@/lib/auth/api"
import { Button } from "@/components/ui/button"
import { AddUserDialog } from "./AddUserDialog"
import { EditUserDialog } from "./EditUserDialog"
import {
  Users,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldOff,
  AlertCircle,
  Download,
  UserPlus,
  Pencil,
} from "lucide-react"

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(undefined, {
    year:  "numeric",
    month: "short",
    day:   "numeric",
  })
}

function UserStatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800">
      <CheckCircle2 className="size-3" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-800">
      <XCircle className="size-3" />
      Inactive
    </span>
  )
}

function TotpBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
      <ShieldCheck className="size-3.5" />
      On
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <ShieldOff className="size-3.5" />
      Off
    </span>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { getAccessToken } = useAuth()

  const [users,       setUsers]       = useState<UserListItem[]>([])
  const [isLoading,   setIsLoading]   = useState(true)
  const [error,       setError]       = useState<{ code: string; message: string } | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [addOpen,     setAddOpen]     = useState(false)
  const [editUser,    setEditUser]    = useState<UserListItem | null>(null)

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
        const data = await apiGetUsers(token)
        if (!cancelled) {
          setUsers(data)
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

  const handleExport = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setExportError("No access token available. Please log in again.")
      return
    }

    setIsExporting(true)
    setExportError(null)

    try {
      const blob = await apiExportUsers(token)
      const url  = URL.createObjectURL(blob)
      const date = new Date().toISOString().slice(0, 10)

      const anchor      = document.createElement("a")
      anchor.href       = url
      anchor.download   = `users-${date}.csv`
      anchor.style.display = "none"
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch (err) {
      if (err instanceof ApiError) {
        setExportError(err.message)
      } else {
        setExportError("Export failed. Please try again.")
      }
    } finally {
      setIsExporting(false)
    }
  }, [getAccessToken])

  const handleUserCreated = useCallback((newUser: UserListItem) => {
    setUsers((prev) => [newUser, ...prev])
  }, [])

  const handleUserUpdated = useCallback((updated: UserListItem) => {
    setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u))
  }, [])

  // ── Render states ────────────────────────────────────────────────────────────

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

  if (error) {
    const is403 = error.code === "FORBIDDEN"
    return (
      <div className="flex flex-col gap-6">
        <PageHeader />
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-16 text-center">
          {is403 ? (
            <ShieldAlert className="size-8 text-destructive" />
          ) : (
            <AlertCircle className="size-8 text-destructive" />
          )}
          <p className="font-medium">
            {is403 ? "Access Denied" : "Failed to load users"}
          </p>
          <p className="text-sm text-muted-foreground max-w-sm">
            {error.message}
          </p>
        </div>
      </div>
    )
  }

  // ── Main table ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        count={users.length}
        onExport={handleExport}
        isExporting={isExporting}
        onAddUser={() => setAddOpen(true)}
      />

      <AddUserDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={handleUserCreated}
      />

      <EditUserDialog
        user={editUser}
        open={editUser !== null}
        onClose={() => setEditUser(null)}
        onUpdated={handleUserUpdated}
      />

      {exportError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {exportError}
        </div>
      )}

      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-16 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No users found.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Username</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">2FA</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Last Login</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {u.firstName} {u.lastName}
                      {u.employeeCode && (
                        <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                          #{u.employeeCode}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs whitespace-nowrap">
                      {u.username}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
                        {u.role.roleName}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <UserStatusBadge isActive={u.isActive} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <TotpBadge enabled={u.totpEnabled} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                      {formatDate(u.lastLoginAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditUser(u)}
                        aria-label={`Edit ${u.firstName} ${u.lastName}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function PageHeader({
  count,
  onExport,
  isExporting,
  onAddUser,
}: {
  count?:      number
  onExport?:   () => void
  isExporting?: boolean
  onAddUser?:  () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
          <Users className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage user accounts and access
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {count !== undefined && (
          <span className="text-sm text-muted-foreground mr-1">
            {count} {count === 1 ? "user" : "users"}
          </span>
        )}
        {onExport && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Download className="size-4 mr-2" />
            )}
            {isExporting ? "Exporting…" : "Export CSV"}
          </Button>
        )}
        {onAddUser && (
          <Button size="sm" onClick={onAddUser}>
            <UserPlus className="size-4 mr-2" />
            Add User
          </Button>
        )}
      </div>
    </div>
  )
}
