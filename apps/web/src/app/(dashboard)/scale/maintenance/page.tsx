"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/lib/auth/useAuth"
import {
  apiListScalesForMaintenance,
  apiListScaleMaintenanceTypes,
  apiListScaleMaintenanceLogs,
  apiCreateScaleMaintenance,
  apiStartScaleMaintenance,
  apiStopScaleMaintenance,
  apiApproveScaleMaintenance,
  apiRejectScaleMaintenance,
  ApiError,
  type ScaleListItem,
  type ScaleMaintenanceTypeItem,
  type ScaleMaintenanceLogItem,
  type MaintenanceStatus,
} from "@/lib/auth/api"
import { Button } from "@/components/ui/button"
import {
  Scale,
  Wrench,
  Play,
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

function formatDt(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return "—"
  const h = Math.floor(minutes / 60); const m = minutes % 60
  if (h === 0) return `${m}m`; if (m === 0) return `${h}h`; return `${h}h ${m}m`
}

const SCALE_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active:            { label: "Active",            className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  under_repair:      { label: "Under Maintenance", className: "bg-red-50 text-red-700 ring-red-200" },
  under_maintenance: { label: "Under Maintenance", className: "bg-red-50 text-red-700 ring-red-200" },
  quarantined:       { label: "Quarantined",       className: "bg-orange-50 text-orange-700 ring-orange-200" },
  retired:           { label: "Retired",           className: "bg-slate-100 text-slate-500 ring-slate-200" },
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  active:    { label: "In Progress",      className: "bg-red-50 text-red-700 ring-red-200",            icon: Wrench },
  scheduled: { label: "Pending Approval", className: "bg-amber-50 text-amber-700 ring-amber-200",       icon: Clock },
  stopped:   { label: "Completed",        className: "bg-emerald-50 text-emerald-700 ring-emerald-200", icon: CheckCircle2 },
  cancelled: { label: "Rejected",         className: "bg-slate-100 text-slate-600 ring-slate-200",      icon: XCircle },
}

function ScaleCurrentStatusBadge({ status }: { status: string }) {
  const cfg = SCALE_STATUS_LABELS[status] ?? SCALE_STATUS_LABELS.active
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1", cfg.className)}>
      {cfg.label}
    </span>
  )
}

function MaintenanceStatusBadge({ status, authorizationStatus }: { status: MaintenanceStatus; authorizationStatus: string }) {
  if (status === "scheduled" && authorizationStatus === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 bg-emerald-50 text-emerald-700 ring-emerald-200">
        <ShieldCheck className="size-3" />Approved
      </span>
    )
  }
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.stopped
  const Icon = cfg.icon
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1", cfg.className)}>
      <Icon className="size-3" />{cfg.label}
    </span>
  )
}

function AuthBadge({ auth }: { auth: string }) {
  if (auth === "approved") return <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><ShieldCheck className="size-3.5" /> Approved</span>
  if (auth === "rejected") return <span className="inline-flex items-center gap-1 text-xs text-red-600"><ShieldX className="size-3.5" /> Rejected</span>
  if (auth === "pending")  return <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Clock className="size-3.5" /> Awaiting Approval</span>
  return <span className="text-xs text-muted-foreground">—</span>
}

// ── Add Dialog ─────────────────────────────────────────────────────────────────

interface AddDialogProps {
  scales: ScaleListItem[]
  types: ScaleMaintenanceTypeItem[]
  onClose: () => void
  onSaved: () => void
  getAccessToken: () => string | null
}

function AddMaintenanceDialog({ scales, types, onClose, onSaved, getAccessToken }: AddDialogProps) {
  const now = new Date()
  const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  const [scaleId, setScaleId]                   = useState("")
  const [maintenanceTypeId, setMaintenanceTypeId] = useState("")
  const [startDatetime, setStartDatetime]         = useState(localIso)
  const [reason, setReason]                       = useState("")
  const [submitting, setSubmitting]               = useState(false)
  const [error, setError]                         = useState<string | null>(null)

  const availableScales = scales.filter((s) => s.isActive && s.status === "active")
  const activeTypes     = types.filter((t) => t.isActive)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    if (!scaleId)           { setError("Please select a scale."); return }
    if (!maintenanceTypeId) { setError("Please select a maintenance type."); return }
    if (!reason.trim())     { setError("Please enter a reason."); return }
    const token = getAccessToken(); if (!token) { setError("Session expired."); return }
    setSubmitting(true)
    try {
      await apiCreateScaleMaintenance(token, {
        scaleId,
        maintenanceTypeId,
        maintenanceStartDatetime: new Date(startDatetime).toISOString(),
        reasonForMaintenance: reason.trim(),
      })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create maintenance record.")
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl border shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <Wrench className="size-4 text-sky-600" />
            <h2 className="font-semibold text-base">Add Scale for Maintenance</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />{error}
            </div>
          )}
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
            The scale will be blocked immediately. A System Administrator will be notified to approve or reject.
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Scale <span className="text-red-500">*</span></label>
            <select
              value={scaleId}
              onChange={(e) => setScaleId(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            >
              <option value="">— Select Scale —</option>
              {availableScales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.scaleCode} — {s.scaleName}
                  {s.capacity ? ` (${s.capacity})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Maintenance Type <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-2">
              {activeTypes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMaintenanceTypeId(t.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                    maintenanceTypeId === t.id
                      ? "border-sky-600 bg-sky-50 text-sky-700"
                      : "border-border text-muted-foreground hover:border-sky-400",
                  )}
                >
                  {t.maintenanceTypeName}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Scheduled Start <span className="text-red-500">*</span></label>
            <input
              type="datetime-local"
              value={startDatetime}
              onChange={(e) => setStartDatetime(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Reason / Remarks <span className="text-red-500">*</span></label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Describe the reason for maintenance..."
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" size="sm" disabled={submitting} className="bg-sky-600 hover:bg-sky-700 text-white">
              {submitting
                ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Saving…</>
                : <><Plus className="size-3.5 mr-1.5" /> Submit Request</>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Start Dialog ───────────────────────────────────────────────────────────────

interface StartDialogProps { log: ScaleMaintenanceLogItem; onClose: () => void; onSaved: () => void; getAccessToken: () => string | null }

function StartMaintenanceDialog({ log, onClose, onSaved, getAccessToken }: StartDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function handleStart() {
    setError(null); const token = getAccessToken(); if (!token) { setError("Session expired."); return }
    setSubmitting(true)
    try { await apiStartScaleMaintenance(token, log.id); onSaved() }
    catch (err) { setError(err instanceof ApiError ? err.message : "Failed to start maintenance.") }
    finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl border shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2"><Play className="size-4 text-emerald-600" /><h2 className="font-semibold text-base">Start Scale Maintenance</h2></div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          {error && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"><AlertCircle className="size-4 mt-0.5 shrink-0" />{error}</div>}
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-1">
            <div><span className="font-medium">Scale:</span> {log.scaleCode} — {log.scaleName}</div>
            <div><span className="font-medium">Maintenance Type:</span> {log.maintenanceTypeName}</div>
            <div><span className="font-medium">Reason:</span> {log.reasonForMaintenance}</div>
          </div>
          <p className="text-sm text-muted-foreground">The current time will be recorded as the maintenance start time.</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button size="sm" disabled={submitting} onClick={handleStart} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {submitting ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Starting…</> : <><Play className="size-3.5 mr-1.5" /> Start Maintenance</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Stop Dialog ────────────────────────────────────────────────────────────────

interface StopDialogProps { log: ScaleMaintenanceLogItem; onClose: () => void; onSaved: () => void; getAccessToken: () => string | null }

function StopMaintenanceDialog({ log, onClose, onSaved, getAccessToken }: StopDialogProps) {
  const [remarks, setRemarks]       = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null); const token = getAccessToken(); if (!token) { setError("Session expired."); return }
    setSubmitting(true)
    try { await apiStopScaleMaintenance(token, log.id, { completionRemarks: remarks.trim() || undefined }); onSaved() }
    catch (err) { setError(err instanceof ApiError ? err.message : "Failed to stop maintenance.") }
    finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl border shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2"><StopCircle className="size-4 text-red-500" /><h2 className="font-semibold text-base">Stop Scale Maintenance</h2></div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          {error && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"><AlertCircle className="size-4 mt-0.5 shrink-0" />{error}</div>}
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-1">
            <div><span className="font-medium">Scale:</span> {log.scaleCode} — {log.scaleName}</div>
            <div><span className="font-medium">Type:</span> {log.maintenanceTypeName}</div>
            <div><span className="font-medium">Started:</span> {formatDt(log.maintenanceStartDatetime)}</div>
          </div>
          <p className="text-sm text-muted-foreground">The scale will be restored to active status after stopping.</p>
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
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" size="sm" disabled={submitting} className="bg-red-600 hover:bg-red-700 text-white">
              {submitting ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Stopping…</> : <><StopCircle className="size-3.5 mr-1.5" /> Stop Maintenance</>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Auth Dialog ────────────────────────────────────────────────────────────────

interface AuthDialogProps { log: ScaleMaintenanceLogItem; mode: "approve" | "reject"; onClose: () => void; onSaved: () => void; getAccessToken: () => string | null }

function AuthDialog({ log, mode, onClose, onSaved, getAccessToken }: AuthDialogProps) {
  const [remarks, setRemarks]       = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    if (mode === "reject" && !remarks.trim()) { setError("Reason for rejection is required."); return }
    const token = getAccessToken(); if (!token) { setError("Session expired."); return }
    setSubmitting(true)
    try {
      if (mode === "approve") await apiApproveScaleMaintenance(token, log.id, { authorizationRemarks: remarks.trim() || undefined })
      else await apiRejectScaleMaintenance(token, log.id, { authorizationRemarks: remarks.trim() })
      onSaved()
    } catch (err) { setError(err instanceof ApiError ? err.message : `Failed to ${mode} maintenance.`) }
    finally { setSubmitting(false) }
  }

  const isApprove = mode === "approve"
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl border shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            {isApprove ? <ShieldCheck className="size-4 text-emerald-600" /> : <ShieldX className="size-4 text-red-500" />}
            <h2 className="font-semibold text-base">{isApprove ? "Approve Maintenance Request" : "Reject Maintenance Request"}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          {error && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"><AlertCircle className="size-4 mt-0.5 shrink-0" />{error}</div>}
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-1">
            <div><span className="font-medium">Scale:</span> {log.scaleCode} — {log.scaleName}</div>
            {log.capacity && <div><span className="font-medium">Capacity:</span> {log.capacity}</div>}
            <div><span className="font-medium">Maintenance Type:</span> {log.maintenanceTypeName}</div>
            <div><span className="font-medium">Requested by:</span> {log.markedByName}</div>
            <div><span className="font-medium">Reason:</span> {log.reasonForMaintenance}</div>
          </div>
          {isApprove && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              Approving will allow the Maintenance Technician to start this maintenance.
            </p>
          )}
          {!isApprove && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Rejecting will cancel this maintenance and restore the scale to active.
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Remarks {!isApprove && <span className="text-red-500">*</span>}</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              placeholder={isApprove ? "Optional remarks..." : "Required — reason for rejection..."}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              required={!isApprove}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" size="sm" disabled={submitting} className={cn("text-white", isApprove ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700")}>
              {submitting ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : isApprove ? <ShieldCheck className="size-3.5 mr-1.5" /> : <ShieldX className="size-3.5 mr-1.5" />}
              {submitting ? "Processing…" : isApprove ? "Approve" : "Reject"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Stats Card ─────────────────────────────────────────────────────────────────

function StatsCard({ label, value, className, icon: Icon }: { label: string; value: number; className: string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-4">
      <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg", className)}><Icon className="size-5" /></div>
      <div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ScaleMaintenancePage() {
  const { getAccessToken, user } = useAuth()
  const [logs, setLogs]               = useState<ScaleMaintenanceLogItem[]>([])
  const [scales, setScales]           = useState<ScaleListItem[]>([])
  const [types, setTypes]             = useState<ScaleMaintenanceTypeItem[]>([])
  const [isLoading, setIsLoading]     = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [search, setSearch]           = useState("")
  const [addOpen, setAddOpen]         = useState(false)
  const [startTarget, setStartTarget] = useState<ScaleMaintenanceLogItem | null>(null)
  const [stopTarget, setStopTarget]   = useState<ScaleMaintenanceLogItem | null>(null)
  const [authTarget, setAuthTarget]   = useState<{ log: ScaleMaintenanceLogItem; mode: "approve" | "reject" } | null>(null)

  const load = useCallback(async () => {
    const token = getAccessToken(); if (!token) { setError("No access token."); setIsLoading(false); return }
    setIsLoading(true); setError(null)
    try {
      const [logsData, scalesData, typesData] = await Promise.all([
        apiListScaleMaintenanceLogs(token),
        apiListScalesForMaintenance(token),
        apiListScaleMaintenanceTypes(token),
      ])
      setLogs(logsData); setScales(scalesData); setTypes(typesData)
    } catch (err) { setError(err instanceof ApiError ? err.message : "Failed to load data.") }
    finally { setIsLoading(false) }
  }, [getAccessToken])

  useEffect(() => { load() }, [load])

  const isUserAdmin             = user?.role === "User Admin"
  const isSysAdmin              = user?.role === "System Administrator"
  const isMaintenanceTechnician = user?.role === "Maintenance Technician"

  // Maintenance Technician only sees approved records
  const visibleLogs = isMaintenanceTechnician
    ? logs.filter((l) =>
        l.authorizationStatus === "approved" &&
        (l.status === "scheduled" || l.status === "active" || l.status === "stopped")
      )
    : logs

  const filtered = visibleLogs.filter((l) => {
    const matchStatus = statusFilter === "all" || l.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      l.scaleCode.toLowerCase().includes(q) ||
      l.scaleName.toLowerCase().includes(q) ||
      l.maintenanceTypeName.toLowerCase().includes(q) ||
      l.reasonForMaintenance.toLowerCase().includes(q) ||
      (l.capacity ?? "").toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const activeCount  = logs.filter((l) => l.status === "active").length
  const pendingCount = logs.filter((l) => l.status === "scheduled" && l.authorizationStatus === "pending").length
  const stoppedCount = logs.filter((l) => l.status === "stopped").length

  function onDialogSaved() {
    setAddOpen(false); setStartTarget(null); setStopTarget(null); setAuthTarget(null); load()
  }

  const canStartStop = isMaintenanceTechnician

  return (
    <>
      {addOpen && isUserAdmin && (
        <AddMaintenanceDialog
          scales={scales}
          types={types}
          onClose={() => setAddOpen(false)}
          onSaved={onDialogSaved}
          getAccessToken={getAccessToken}
        />
      )}
      {startTarget && canStartStop && (
        <StartMaintenanceDialog
          log={startTarget}
          onClose={() => setStartTarget(null)}
          onSaved={onDialogSaved}
          getAccessToken={getAccessToken}
        />
      )}
      {stopTarget && canStartStop && (
        <StopMaintenanceDialog
          log={stopTarget}
          onClose={() => setStopTarget(null)}
          onSaved={onDialogSaved}
          getAccessToken={getAccessToken}
        />
      )}
      {authTarget && isSysAdmin && (
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
        <StatsCard label="Total Records"     value={logs.length}  className="bg-sky-500/10 text-sky-600"         icon={Scale} />
        <StatsCard label="Awaiting Approval" value={pendingCount} className="bg-amber-500/10 text-amber-600"     icon={Clock} />
        <StatsCard label="In Progress"       value={activeCount}  className="bg-red-500/10 text-red-600"         icon={Wrench} />
        <StatsCard label="Completed"         value={stoppedCount} className="bg-emerald-500/10 text-emerald-600" icon={CheckCircle2} />
      </div>

      {/* Table card */}
      <div className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b">
          <h2 className="font-semibold text-sm">Scale Maintenance Records</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={isLoading} className="h-8">
              <RefreshCw className={cn("size-3.5 mr-1.5", isLoading && "animate-spin")} />Refresh
            </Button>
            {isUserAdmin && (
              <Button size="sm" onClick={() => setAddOpen(true)} className="h-8 bg-sky-600 hover:bg-sky-700 text-white">
                <Plus className="size-3.5 mr-1.5" />Add Maintenance
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search scale, type, reason…"
              className="h-8 w-full rounded-md border bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="size-3" />
              </button>
            )}
          </div>
          {(["all", "active", "scheduled", "stopped", "cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
                statusFilter === s
                  ? "border-sky-600 bg-sky-50 text-sky-700"
                  : "border-border text-muted-foreground hover:border-sky-400",
              )}
            >
              {s === "all" ? "All" : s === "active" ? "In Progress" : s === "scheduled" ? "Pending/Approved" : s === "stopped" ? "Completed" : "Rejected"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" /><span className="text-sm">Loading…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-red-600">
            <AlertCircle className="size-6" /><p className="text-sm font-medium">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>Retry</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
            <Scale className="size-8 opacity-30" />
            <p className="text-sm">
              {logs.length === 0
                ? isUserAdmin
                  ? "No maintenance records yet. Click 'Add Maintenance' to get started."
                  : "No maintenance records to display."
                : "No records match your filters."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {[
                    "Scale Id",
                    "Scale Name",
                    "Location",
                    "Capacity",
                    "Current Status",
                    "Maintenance Type",
                    "Maintenance Status",
                    "Start Date & Time",
                    "End Date & Time",
                    "Requested By",
                    "Actions",
                  ].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{log.scaleCode}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{log.scaleName}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      <span className="italic">—</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {log.capacity ?? <span className="italic">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ScaleCurrentStatusBadge status={log.scaleStatus} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{log.maintenanceTypeName}</td>
                    <td className="px-4 py-3">
                      <MaintenanceStatusBadge status={log.status as MaintenanceStatus} authorizationStatus={log.authorizationStatus} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      {(log.status === "active" || log.status === "stopped")
                        ? formatDt(log.maintenanceStartDatetime)
                        : <span className="text-muted-foreground italic">Not started</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      {log.maintenanceEndDatetime ? formatDt(log.maintenanceEndDatetime) : <span className="text-muted-foreground italic">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{log.markedByName}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {isSysAdmin && log.authorizationStatus === "pending" && log.status !== "cancelled" && (
                          <>
                            <Button
                              variant="outline" size="sm"
                              className="h-7 px-2 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => setAuthTarget({ log, mode: "approve" })}
                            >
                              <ShieldCheck className="size-3 mr-1" />Approve
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => setAuthTarget({ log, mode: "reject" })}
                            >
                              <ShieldX className="size-3 mr-1" />Reject
                            </Button>
                          </>
                        )}
                        {canStartStop && log.authorizationStatus === "approved" && log.status === "scheduled" && (
                          <Button
                            variant="outline" size="sm"
                            className="h-7 px-2 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            onClick={() => setStartTarget(log)}
                          >
                            <Play className="size-3 mr-1" />Start
                          </Button>
                        )}
                        {canStartStop && log.status === "active" && (
                          <Button
                            variant="outline" size="sm"
                            className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => setStopTarget(log)}
                          >
                            <StopCircle className="size-3 mr-1" />Stop
                          </Button>
                        )}
                        {!isSysAdmin && !canStartStop && !isUserAdmin && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {isUserAdmin && (
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
