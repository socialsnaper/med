"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/lib/auth/useAuth"
import {
  apiListRooms,
  apiListMaintenanceTypes,
  apiListMaintenanceLogs,
  apiCreateMaintenance,
  apiStopMaintenance,
  apiApproveMaintenance,
  apiRejectMaintenance,
  ApiError,
  type RoomItem,
  type MaintenanceTypeItem,
  type MaintenanceLogItem,
  type MaintenanceStatus,
} from "@/lib/auth/api"
import { Button } from "@/components/ui/button"
import {
  Wrench,
  Plus,
  StopCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Search,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDt(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, {
    year:   "numeric",
    month:  "short",
    day:    "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  })
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return "—"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ── Status Badge ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  MaintenanceStatus,
  { label: string; className: string; icon: React.ElementType }
> = {
  active: {
    label:     "Active",
    className: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-800",
    icon:      Wrench,
  },
  scheduled: {
    label:     "Scheduled",
    className: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800",
    icon:      Clock,
  },
  stopped: {
    label:     "Completed",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800",
    icon:      CheckCircle2,
  },
  cancelled: {
    label:     "Cancelled",
    className: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700",
    icon:      XCircle,
  },
}

function StatusBadge({ status }: { status: MaintenanceStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.stopped
  const Icon = cfg.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1",
        cfg.className,
      )}
    >
      <Icon className="size-3" />
      {cfg.label}
    </span>
  )
}

function AuthBadge({ auth }: { auth: string }) {
  if (auth === "approved")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <ShieldCheck className="size-3.5" /> Approved
      </span>
    )
  if (auth === "rejected")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
        <ShieldX className="size-3.5" /> Rejected
      </span>
    )
  if (auth === "pending")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
        <Clock className="size-3.5" /> Pending
      </span>
    )
  return <span className="text-xs text-muted-foreground">—</span>
}

// ── Add Maintenance Dialog ─────────────────────────────────────────────────────

interface AddDialogProps {
  rooms:            RoomItem[]
  types:            MaintenanceTypeItem[]
  onClose:          () => void
  onSaved:          () => void
  getAccessToken:   () => string | null
}

function AddMaintenanceDialog({ rooms, types, onClose, onSaved, getAccessToken }: AddDialogProps) {
  const now = new Date()
  const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)

  const [roomId,           setRoomId]           = useState("")
  const [maintenanceTypeId, setMaintenanceTypeId] = useState("")
  const [startDatetime,    setStartDatetime]    = useState(localIso)
  const [reason,           setReason]           = useState("")
  const [submitting,       setSubmitting]       = useState(false)
  const [error,            setError]            = useState<string | null>(null)

  const availableRooms = rooms.filter((r) => r.isActive && r.status === "active")
  const activeTypes    = types.filter((t) => t.isActive)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!roomId)             { setError("Please select a room."); return }
    if (!maintenanceTypeId)  { setError("Please select a maintenance type."); return }
    if (!startDatetime)      { setError("Please set a start date/time."); return }
    if (!reason.trim())      { setError("Please enter a reason for maintenance."); return }

    const token = getAccessToken()
    if (!token) { setError("Session expired. Please log in again."); return }

    setSubmitting(true)
    try {
      await apiCreateMaintenance(token, {
        roomId,
        maintenanceTypeId,
        maintenanceStartDatetime: new Date(startDatetime).toISOString(),
        reasonForMaintenance:     reason.trim(),
      })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create maintenance record.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl border shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <Wrench className="size-4 text-sky-600" />
            <h2 className="font-semibold text-base">Add Room for Maintenance</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Room */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Room <span className="text-red-500">*</span>
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            >
              <option value="">— Select Room —</option>
              {availableRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomId} — {r.roomName}
                  {r.floor ? ` (Floor ${r.floor})` : ""}
                </option>
              ))}
            </select>
            {availableRooms.length === 0 && (
              <p className="text-xs text-muted-foreground">No rooms available (all may already be under maintenance).</p>
            )}
          </div>

          {/* Maintenance Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Maintenance Type <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {activeTypes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMaintenanceTypeId(t.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                    maintenanceTypeId === t.id
                      ? "border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                      : "border-border text-muted-foreground hover:border-sky-400 hover:text-foreground",
                  )}
                >
                  {t.maintenanceTypeName}
                </button>
              ))}
            </div>
          </div>

          {/* Start Date & Time */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Start Date &amp; Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={startDatetime}
              onChange={(e) => setStartDatetime(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            />
          </div>

          {/* Reason */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Reason / Remarks <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Describe the reason for maintenance..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting} className="bg-sky-600 hover:bg-sky-700 text-white">
              {submitting ? (
                <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Saving…</>
              ) : (
                <><Plus className="size-3.5 mr-1.5" /> Add Maintenance</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Stop Maintenance Dialog ────────────────────────────────────────────────────

interface StopDialogProps {
  log:            MaintenanceLogItem
  onClose:        () => void
  onSaved:        () => void
  getAccessToken: () => string | null
}

function StopMaintenanceDialog({ log, onClose, onSaved, getAccessToken }: StopDialogProps) {
  const [remarks,    setRemarks]    = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const token = getAccessToken()
    if (!token) { setError("Session expired."); return }
    setSubmitting(true)
    try {
      await apiStopMaintenance(token, log.id, { completionRemarks: remarks.trim() || undefined })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to stop maintenance.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl border shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <StopCircle className="size-4 text-red-500" />
            <h2 className="font-semibold text-base">Stop Maintenance</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-1">
            <div><span className="font-medium">Room:</span> {log.roomCode} — {log.roomName}</div>
            <div><span className="font-medium">Type:</span> {log.maintenanceTypeName}</div>
            <div><span className="font-medium">Started:</span> {formatDt(log.maintenanceStartDatetime)}</div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Completion Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              placeholder="Optional — describe what was done..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting ? (
                <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Stopping…</>
              ) : (
                <><StopCircle className="size-3.5 mr-1.5" /> Stop Maintenance</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Approve / Reject Dialog ────────────────────────────────────────────────────

interface AuthDialogProps {
  log:            MaintenanceLogItem
  mode:           "approve" | "reject"
  onClose:        () => void
  onSaved:        () => void
  getAccessToken: () => string | null
}

function AuthDialog({ log, mode, onClose, onSaved, getAccessToken }: AuthDialogProps) {
  const [remarks,    setRemarks]    = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (mode === "reject" && !remarks.trim()) {
      setError("Reason for rejection is required.")
      return
    }
    const token = getAccessToken()
    if (!token) { setError("Session expired."); return }
    setSubmitting(true)
    try {
      if (mode === "approve") {
        await apiApproveMaintenance(token, log.id, { authorizationRemarks: remarks.trim() || undefined })
      } else {
        await apiRejectMaintenance(token, log.id, { authorizationRemarks: remarks.trim() })
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${mode} maintenance.`)
    } finally {
      setSubmitting(false)
    }
  }

  const isApprove = mode === "approve"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl border shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            {isApprove
              ? <ShieldCheck className="size-4 text-emerald-600" />
              : <ShieldX className="size-4 text-red-500" />}
            <h2 className="font-semibold text-base">
              {isApprove ? "Approve Maintenance" : "Reject Maintenance"}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-1">
            <div><span className="font-medium">Room:</span> {log.roomCode} — {log.roomName}</div>
            <div><span className="font-medium">Type:</span> {log.maintenanceTypeName}</div>
            <div><span className="font-medium">Started:</span> {formatDt(log.maintenanceStartDatetime)}</div>
            <div><span className="font-medium">Reason:</span> {log.reasonForMaintenance}</div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Remarks {!isApprove && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              placeholder={
                isApprove
                  ? "Optional authorization remarks..."
                  : "Required — reason for rejection..."
              }
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              required={!isApprove}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className={cn(
                "text-white",
                isApprove
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700",
              )}
            >
              {submitting ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : isApprove ? (
                <ShieldCheck className="size-3.5 mr-1.5" />
              ) : (
                <ShieldX className="size-3.5 mr-1.5" />
              )}
              {submitting ? "Processing…" : isApprove ? "Approve" : "Reject"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Stats Cards ───────────────────────────────────────────────────────────────

function StatsCard({
  label,
  value,
  className,
  icon: Icon,
}: {
  label:     string
  value:     number
  className: string
  icon:      React.ElementType
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-4">
      <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg", className)}>
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function RoomMaintenancePage() {
  const { getAccessToken, user } = useAuth()

  const [logs,        setLogs]        = useState<MaintenanceLogItem[]>([])
  const [rooms,       setRooms]       = useState<RoomItem[]>([])
  const [types,       setTypes]       = useState<MaintenanceTypeItem[]>([])
  const [isLoading,   setIsLoading]   = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [search,      setSearch]      = useState("")

  // dialogs
  const [addOpen,     setAddOpen]     = useState(false)
  const [stopTarget,  setStopTarget]  = useState<MaintenanceLogItem | null>(null)
  const [authTarget,  setAuthTarget]  = useState<{ log: MaintenanceLogItem; mode: "approve" | "reject" } | null>(null)

  const load = useCallback(async () => {
    const token = getAccessToken()
    if (!token) { setError("No access token. Please log in again."); setIsLoading(false); return }
    setIsLoading(true)
    setError(null)
    try {
      const [logsData, roomsData, typesData] = await Promise.all([
        apiListMaintenanceLogs(token),
        apiListRooms(token),
        apiListMaintenanceTypes(token),
      ])
      setLogs(logsData)
      setRooms(roomsData)
      setTypes(typesData)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load data.")
    } finally {
      setIsLoading(false)
    }
  }, [getAccessToken])

  useEffect(() => { load() }, [load])

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = logs.filter((l) => {
    const matchStatus = statusFilter === "all" || l.status === statusFilter
    const q           = search.toLowerCase()
    const matchSearch = !q
      || l.roomName.toLowerCase().includes(q)
      || l.roomCode.toLowerCase().includes(q)
      || l.maintenanceTypeName.toLowerCase().includes(q)
      || l.reasonForMaintenance.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const activeCount    = logs.filter((l) => l.status === "active").length
  const scheduledCount = logs.filter((l) => l.status === "scheduled").length
  const stoppedCount   = logs.filter((l) => l.status === "stopped").length
  const totalCount     = logs.length

  // ── Role check for authorization actions ──────────────────────────────────
  const canAuthorize =
    user?.role === "System Administrator" ||
    user?.role === "Quality Manager" ||
    user?.role === "Production Manager"

  // ── Refresh after dialog saves ─────────────────────────────────────────────

  function onDialogSaved() {
    setAddOpen(false)
    setStopTarget(null)
    setAuthTarget(null)
    load()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Dialogs */}
      {addOpen && (
        <AddMaintenanceDialog
          rooms={rooms}
          types={types}
          onClose={() => setAddOpen(false)}
          onSaved={onDialogSaved}
          getAccessToken={getAccessToken}
        />
      )}
      {stopTarget && (
        <StopMaintenanceDialog
          log={stopTarget}
          onClose={() => setStopTarget(null)}
          onSaved={onDialogSaved}
          getAccessToken={getAccessToken}
        />
      )}
      {authTarget && (
        <AuthDialog
          log={authTarget.log}
          mode={authTarget.mode}
          onClose={() => setAuthTarget(null)}
          onSaved={onDialogSaved}
          getAccessToken={getAccessToken}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatsCard label="Total Records" value={totalCount}    className="bg-sky-500/10 text-sky-600"       icon={Wrench} />
        <StatsCard label="Active"        value={activeCount}   className="bg-red-500/10 text-red-600"       icon={Wrench} />
        <StatsCard label="Scheduled"     value={scheduledCount} className="bg-blue-500/10 text-blue-600"   icon={Clock} />
        <StatsCard label="Completed"     value={stoppedCount}  className="bg-emerald-500/10 text-emerald-600" icon={CheckCircle2} />
      </div>

      {/* Toolbar */}
      <div className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b">
          <h2 className="font-semibold text-sm">Maintenance Records</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              disabled={isLoading}
              className="h-8"
            >
              <RefreshCw className={cn("size-3.5 mr-1.5", isLoading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
              className="h-8 bg-sky-600 hover:bg-sky-700 text-white"
            >
              <Plus className="size-3.5 mr-1.5" />
              Add Maintenance
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rooms, type, reason…"
              className="h-8 w-full rounded-md border bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Status filter pills */}
          {(["all", "active", "scheduled", "stopped", "cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
                statusFilter === s
                  ? "border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                  : "border-border text-muted-foreground hover:border-sky-400",
              )}
            >
              {s === "all"       ? "All"
               : s === "active"    ? "Active"
               : s === "scheduled" ? "Scheduled"
               : s === "stopped"   ? "Completed"
               : "Cancelled"}
            </button>
          ))}
        </div>

        {/* Table / States */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-red-600">
            <AlertCircle className="size-6" />
            <p className="text-sm font-medium">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>Retry</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
            <Wrench className="size-8 opacity-30" />
            <p className="text-sm">
              {logs.length === 0
                ? "No maintenance records yet. Click 'Add Maintenance' to get started."
                : "No records match your filters."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Room ID</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Room Name</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Room Type</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Location</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Maintenance Type</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Start Date &amp; Time</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">End Date &amp; Time</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Requested By</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    {/* Room ID */}
                    <td className="px-4 py-3 font-mono text-xs font-medium">{log.roomCode}</td>

                    {/* Room Name */}
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{log.roomName}</td>

                    {/* Room Type */}
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {log.roomTypeName ?? <span className="text-xs italic">—</span>}
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {log.floor || log.building ? (
                        <div>
                          {log.building && <div className="text-xs font-medium">{log.building}</div>}
                          {log.floor && <div className="text-xs text-muted-foreground">{log.floor}</div>}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </td>

                    {/* Maintenance Type */}
                    <td className="px-4 py-3 whitespace-nowrap">{log.maintenanceTypeName}</td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={log.status} />
                    </td>

                    {/* Start */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs">{formatDt(log.maintenanceStartDatetime)}</td>

                    {/* End */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      {log.maintenanceEndDatetime
                        ? formatDt(log.maintenanceEndDatetime)
                        : <span className="text-muted-foreground italic">In progress</span>}
                    </td>

                    {/* Requested By */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {log.markedByName}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {log.status === "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => setStopTarget(log)}
                          >
                            <StopCircle className="size-3 mr-1" />
                            Stop
                          </Button>
                        )}
                        {log.authorizationStatus === "pending" && canAuthorize && log.status !== "cancelled" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => setAuthTarget({ log, mode: "approve" })}
                            >
                              <ShieldCheck className="size-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => setAuthTarget({ log, mode: "reject" })}
                            >
                              <ShieldX className="size-3 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {log.status !== "active" && log.authorizationStatus !== "pending" && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
