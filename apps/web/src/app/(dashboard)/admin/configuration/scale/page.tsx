"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/useAuth"
import {
  apiListScales, apiDeleteScale, apiExportScales, apiImportScales,
  type ScaleItem, type ScaleImportRow,
  SCALE_TYPES, SCALE_STATUSES, ApiError,
} from "@/lib/auth/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AddScaleDialog } from "./AddScaleDialog"
import { EditScaleDialog } from "./EditScaleDialog"
import {
  Gauge, ChevronLeft, Plus, Pencil, Trash2, Search,
  Loader2, AlertCircle, CheckCircle2, XCircle, Download,
  Upload, RefreshCw, X, AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Helpers ────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  analytical: "Analytical", precision: "Precision",
  industrial: "Industrial", moisture: "Moisture", other: "Other",
}

const TYPE_COLORS: Record<string, string> = {
  analytical: "bg-purple-50 text-purple-700 ring-purple-200",
  precision:  "bg-blue-50 text-blue-700 ring-blue-200",
  industrial: "bg-stone-50 text-stone-700 ring-stone-200",
  moisture:   "bg-cyan-50 text-cyan-700 ring-cyan-200",
  other:      "bg-slate-50 text-slate-600 ring-slate-200",
}

const STATUS_COLORS: Record<string, string> = {
  active:       "bg-emerald-50 text-emerald-700 ring-emerald-200",
  quarantined:  "bg-red-50 text-red-700 ring-red-200",
  under_repair: "bg-amber-50 text-amber-700 ring-amber-200",
  retired:      "bg-slate-100 text-slate-500 ring-slate-200",
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active", quarantined: "Quarantined",
  under_repair: "Under Repair", retired: "Retired",
}

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-muted-foreground text-xs">—</span>
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1",
      TYPE_COLORS[type] ?? TYPE_COLORS.other,
    )}>
      {TYPE_LABELS[type] ?? type}
    </span>
  )
}

function StatusBadge({ status, isActive }: { status: string; isActive: boolean }) {
  if (!isActive) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
      <XCircle className="size-3" /> Inactive
    </span>
  )
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1",
      STATUS_COLORS[status] ?? STATUS_COLORS.active,
    )}>
      {status === "active" && <CheckCircle2 className="size-3" />}
      {status !== "active" && <AlertTriangle className="size-3" />}
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function DueBadge({ date, label }: { date: string | null; label: string }) {
  if (!date) return <span className="text-muted-foreground text-xs">—</span>
  const today    = new Date()
  const due      = new Date(date)
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86400000)
  const formatted = due.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })

  if (diffDays < 0)  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
      <AlertTriangle className="size-3" /> {formatted}
    </span>
  )
  if (diffDays <= 7) return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
      <AlertTriangle className="size-3" /> {formatted}
    </span>
  )
  return <span className="text-xs text-muted-foreground">{formatted}</span>
}

// ── CSV template ──────────────────────────────────────────────────────────────

const CSV_TEMPLATE = [
  "scale_number,scale_type,min_range,max_range,capacity,least_count,manufacturer,model_number,last_verified_on,next_verification_due,verification_interval_days,form_verification_no,next_calibration_due,calibration_interval_days,form_calibration_no",
  "SN-1001,analytical,1 g,200 g,200 g,0.01 g,Mettler Toledo,ME204,2025-03-01,2025-03-02,1,FV-001,2026-03-01,365,FC-001",
  "SN-1002,precision,10 g,5 kg,5 kg,0.1 g,Sartorius,CPA2202S,2025-02-10,2025-02-11,1,FV-002,2026-02-10,365,FC-002",
].join("\n")

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = "scales_template.csv"; a.click()
  URL.revokeObjectURL(url)
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCsv(text: string): ScaleImportRow[] {
  const lines  = text.trim().split(/\r?\n/)
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
  return lines.slice(1).map((line) => {
    const cols: Record<string, string> = {}
    line.split(",").forEach((v, i) => { cols[header[i] ?? `col${i}`] = v.trim().replace(/^"|"$/g, "") })
    const row: ScaleImportRow = { scaleNumber: cols["scale_number"] ?? "" }
    if (cols["scale_type"])                 row.scaleType                = cols["scale_type"] as ScaleImportRow["scaleType"]
    if (cols["min_range"])                  row.minRange                 = cols["min_range"]
    if (cols["max_range"])                  row.maxRange                 = cols["max_range"]
    if (cols["capacity"])                   row.capacity                 = cols["capacity"]
    if (cols["least_count"])                row.leastCount               = cols["least_count"]
    if (cols["manufacturer"])               row.manufacturer             = cols["manufacturer"]
    if (cols["model_number"])               row.modelNumber              = cols["model_number"]
    if (cols["last_verified_on"])           row.lastVerifiedOn           = cols["last_verified_on"]
    if (cols["next_verification_due"])      row.nextVerificationDue      = cols["next_verification_due"]
    if (cols["verification_interval_days"]) row.verificationIntervalDays = Number(cols["verification_interval_days"]) || 1
    if (cols["form_verification_no"])       row.formVerificationNo       = cols["form_verification_no"]
    if (cols["next_calibration_due"])       row.nextCalibrationDue       = cols["next_calibration_due"]
    if (cols["calibration_interval_days"])  row.calibrationIntervalDays  = Number(cols["calibration_interval_days"]) || 365
    if (cols["form_calibration_no"])        row.formCalibrationNo        = cols["form_calibration_no"]
    return row
  }).filter((r) => r.scaleNumber)
}

// ── Delete confirmation ────────────────────────────────────────────────────────

function DeleteConfirm({ item, onConfirm, onCancel, isDeleting }: {
  item: ScaleItem; onConfirm: () => void; onCancel: () => void; isDeleting: boolean
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <p className="text-sm font-medium text-destructive">
        Delete <span className="font-mono">{item.scaleId}</span> — {item.scaleNumber}?
      </p>
      <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" onClick={onConfirm} disabled={isDeleting}>
          {isDeleting && <Loader2 className="mr-1.5 size-3 animate-spin" />} Delete
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={isDeleting}>Cancel</Button>
      </div>
    </div>
  )
}

// ── Import banner ─────────────────────────────────────────────────────────────

function ImportBanner({ result, onClose }: {
  result: { created: number; skipped: number; errors: { row: number; message: string }[] }
  onClose: () => void
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Import complete</p>
        <button onClick={onClose}><X className="size-4 text-muted-foreground" /></button>
      </div>
      <div className="flex gap-4 text-sm">
        <span className="text-emerald-600">✓ {result.created} created</span>
        <span className="text-amber-600">⊘ {result.skipped} skipped (duplicates)</span>
        {result.errors.length > 0 && <span className="text-destructive">✗ {result.errors.length} errors</span>}
      </div>
      {result.errors.length > 0 && (
        <ul className="text-xs text-destructive space-y-0.5 max-h-24 overflow-auto">
          {result.errors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
        </ul>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ScalePage() {
  const { user, getAccessToken } = useAuth()
  const router = useRouter()

  const [items,        setItems]        = useState<ScaleItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [search,       setSearch]       = useState("")
  const [filterType,   setFilterType]   = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [addOpen,      setAddOpen]      = useState(false)
  const [editItem,     setEditItem]     = useState<ScaleItem | null>(null)
  const [deleteItem,   setDeleteItem]   = useState<ScaleItem | null>(null)
  const [isDeleting,   setIsDeleting]   = useState(false)
  const [isExporting,  setIsExporting]  = useState(false)
  const [isImporting,  setIsImporting]  = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: { row: number; message: string }[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user && user.role !== "System Administrator" && user.role !== "User Admin") {
      router.replace("/admin")
    }
  }, [user, router])

  const load = useCallback(async (q?: string, type?: string, status?: string) => {
    const token = getAccessToken()
    if (!token) return
    setLoading(true); setError(null)
    try {
      const data = await apiListScales(token, q, type, status)
      setItems(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load scales")
    } finally {
      setLoading(false)
    }
  }, [getAccessToken])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = setTimeout(() => load(search || undefined, filterType || undefined, filterStatus || undefined), 300)
    return () => clearTimeout(t)
  }, [search, filterType, filterStatus, load])

  async function handleDelete() {
    const token = getAccessToken()
    if (!token || !deleteItem) return
    setIsDeleting(true)
    try {
      await apiDeleteScale(token, deleteItem.id)
      setItems((prev) => prev.filter((x) => x.id !== deleteItem.id))
      setDeleteItem(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleExport() {
    const token = getAccessToken()
    if (!token) return
    setIsExporting(true)
    try {
      const blob = await apiExportScales(token)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = "scales.csv"; a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Export failed")
    } finally {
      setIsExporting(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const token = getAccessToken()
    if (!token) return
    setIsImporting(true); setImportResult(null)
    try {
      const text = await file.text()
      const rows = parseCsv(text)
      if (rows.length === 0) { setError("No valid rows found in CSV"); return }
      const result = await apiImportScales(token, rows)
      setImportResult(result)
      await load(search || undefined, filterType || undefined, filterStatus || undefined)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Import failed")
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/configuration">
          <Button variant="ghost" size="icon" className="size-8 shrink-0">
            <ChevronLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-violet-500/10">
            <Gauge className="size-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Scales</h1>
            <p className="text-xs text-muted-foreground">Weighing instruments — verification &amp; calibration tracking</p>
          </div>
        </div>
      </div>

      {/* Import result */}
      {importResult && <ImportBanner result={importResult} onClose={() => setImportResult(null)} />}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />{error}
          <button className="ml-auto" onClick={() => setError(null)}><X className="size-4" /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by Scale ID, Scale No., manufacturer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Types</option>
          {SCALE_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Statuses</option>
          {SCALE_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        <Button variant="outline" size="sm"
          onClick={() => load(search || undefined, filterType || undefined, filterStatus || undefined)}
          disabled={loading}
        >
          <RefreshCw className={cn("size-4 mr-1.5", loading && "animate-spin")} /> Refresh
        </Button>

        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="size-4 mr-1.5" /> Template
        </Button>

        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
          {isImporting ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Upload className="size-4 mr-1.5" />}
          Import
        </Button>
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />

        <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
          {isExporting ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Download className="size-4 mr-1.5" />}
          Export
        </Button>

        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-4 mr-1.5" /> Add Scale
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Gauge className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search || filterType || filterStatus ? "No scales match your filters." : "No scales yet. Add one to get started."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left w-12">S.No</th>
                <th className="px-4 py-3 text-left">Scale ID</th>
                <th className="px-4 py-3 text-left">Scale No.</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Min Range</th>
                <th className="px-4 py-3 text-left">Max Range</th>
                <th className="px-4 py-3 text-left">Capacity</th>
                <th className="px-4 py-3 text-left">Least Count</th>
                <th className="px-4 py-3 text-left">Verified On</th>
                <th className="px-4 py-3 text-left">Calibrated Due</th>
                <th className="px-4 py-3 text-left">Form Veri No.</th>
                <th className="px-4 py-3 text-left">Form Cali No.</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  {deleteItem?.id === item.id ? (
                    <td colSpan={14} className="px-4 py-3">
                      <DeleteConfirm
                        item={item}
                        onConfirm={handleDelete}
                        onCancel={() => setDeleteItem(null)}
                        isDeleting={isDeleting}
                      />
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-3 font-mono font-medium">{item.scaleId}</td>
                      <td className="px-4 py-3 font-mono text-xs">{item.scaleNumber}</td>
                      <td className="px-4 py-3"><TypeBadge type={item.scaleType} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{item.minRange ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{item.maxRange ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{item.capacity ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{item.leastCount ?? "—"}</td>
                      <td className="px-4 py-3">
                        <DueBadge date={item.lastVerifiedOn} label="Verified" />
                      </td>
                      <td className="px-4 py-3">
                        <DueBadge date={item.nextCalibrationDue} label="Cal due" />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{item.formVerificationNo ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{item.formCalibrationNo  ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} isActive={item.isActive} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditItem(item)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteItem(item)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && items.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {items.length} scale{items.length !== 1 ? "s" : ""} total
        </p>
      )}

      <AddScaleDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(item) => setItems((prev) => [...prev, item])}
      />

      <EditScaleDialog
        open={!!editItem}
        item={editItem}
        onClose={() => setEditItem(null)}
        onUpdated={(updated) => setItems((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
      />
    </div>
  )
}
