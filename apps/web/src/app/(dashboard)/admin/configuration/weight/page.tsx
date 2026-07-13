"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/useAuth"
import {
  apiListWeights,
  apiDeleteWeight,
  apiExportWeights,
  apiImportWeights,
  type StandardWeightItem,
  type WeightImportRow,
  ApiError,
} from "@/lib/auth/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AddWeightDialog } from "./AddWeightDialog"
import { EditWeightDialog } from "./EditWeightDialog"
import {
  Scale, ChevronLeft, Plus, Pencil, Trash2, Search,
  Loader2, AlertCircle, CheckCircle2, XCircle, Download,
  Upload, RefreshCw, X, AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
      <CheckCircle2 className="size-3" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
      <XCircle className="size-3" /> Inactive
    </span>
  )
}

// ── Calibration due badge ─────────────────────────────────────────────────────

function CalibrationBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return <span className="text-muted-foreground text-sm">—</span>

  const today = new Date()
  const due   = new Date(dueDate)
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86400000)

  const label = due.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })

  if (diffDays < 0) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
      <AlertTriangle className="size-3" /> {label} (overdue)
    </span>
  )
  if (diffDays <= 30) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
      <AlertTriangle className="size-3" /> {label}
    </span>
  )
  return <span className="text-sm text-muted-foreground">{label}</span>
}

// ── CSV template ──────────────────────────────────────────────────────────────

const CSV_TEMPLATE = [
  "weight_serial_no,standard_weight,weight_value_grams,last_calibrated_on,next_calibration_due,calibration_interval_days,tolerance_limit,material,accuracy_class,storage_location,calibration_lab,certificate_number",
  "WT-001,1 kg,1000,2024-01-15,2025-01-15,365,±0.01 g,Stainless Steel (AISI 316),Class E2,QC Lab Cabinet 2,NABL Lab Mumbai,CERT-2024-001",
  "WT-002,5 kg,5000,2024-01-15,2025-01-15,365,±0.05 g,Stainless Steel (AISI 316),Class F1,QC Lab Cabinet 2,,",
].join("\n")

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = "standard_weights_template.csv"; a.click()
  URL.revokeObjectURL(url)
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCsv(text: string): WeightImportRow[] {
  const lines  = text.trim().split(/\r?\n/)
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
  return lines.slice(1).map((line) => {
    const cols: Record<string, string> = {}
    line.split(",").forEach((v, i) => { cols[header[i] ?? `col${i}`] = v.trim().replace(/^"|"$/g, "") })
    const row: WeightImportRow = {
      weightSerialNo:  cols["weight_serial_no"]  ?? "",
      standardWeight:  cols["standard_weight"]   ?? "",
      weightValueGrams: Number(cols["weight_value_grams"] || 0),
    }
    if (cols["last_calibrated_on"])        row.lastCalibratedOn        = cols["last_calibrated_on"]
    if (cols["next_calibration_due"])      row.nextCalibrationDue      = cols["next_calibration_due"]
    if (cols["calibration_interval_days"]) row.calibrationIntervalDays = Number(cols["calibration_interval_days"])
    if (cols["tolerance_limit"])           row.toleranceLimit          = cols["tolerance_limit"]
    if (cols["material"])                  row.material                = cols["material"]
    if (cols["accuracy_class"])            row.accuracyClass           = cols["accuracy_class"]
    if (cols["storage_location"])          row.storageLocation         = cols["storage_location"]
    if (cols["calibration_lab"])           row.calibrationLab          = cols["calibration_lab"]
    if (cols["certificate_number"])        row.certificateNumber       = cols["certificate_number"]
    return row
  }).filter((r) => r.weightSerialNo && r.standardWeight && r.weightValueGrams > 0)
}

// ── Delete confirmation ────────────────────────────────────────────────────────

function DeleteConfirm({
  item, onConfirm, onCancel, isDeleting,
}: {
  item:       StandardWeightItem
  onConfirm:  () => void
  onCancel:   () => void
  isDeleting: boolean
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <p className="text-sm font-medium text-destructive">
        Delete <span className="font-mono">{item.weightSerialNo}</span> — {item.standardWeight}?
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

// ── Import result banner ──────────────────────────────────────────────────────

function ImportBanner({
  result, onClose,
}: {
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

export default function WeightsPage() {
  const { user, getAccessToken } = useAuth()
  const router = useRouter()

  const [items,       setItems]       = useState<StandardWeightItem[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [search,      setSearch]      = useState("")
  const [addOpen,     setAddOpen]     = useState(false)
  const [editItem,    setEditItem]    = useState<StandardWeightItem | null>(null)
  const [deleteItem,  setDeleteItem]  = useState<StandardWeightItem | null>(null)
  const [isDeleting,  setIsDeleting]  = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: { row: number; message: string }[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user && user.role !== "System Administrator" && user.role !== "User Admin") {
      router.replace("/admin")
    }
  }, [user, router])

  const load = useCallback(async (q?: string) => {
    const token = getAccessToken()
    if (!token) return
    setLoading(true); setError(null)
    try {
      const data = await apiListWeights(token, q)
      setItems(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load weights")
    } finally {
      setLoading(false)
    }
  }, [getAccessToken])

  useEffect(() => { load() }, [load])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => load(search || undefined), 300)
    return () => clearTimeout(t)
  }, [search, load])

  async function handleDelete() {
    const token = getAccessToken()
    if (!token || !deleteItem) return
    setIsDeleting(true)
    try {
      await apiDeleteWeight(token, deleteItem.id)
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
      const blob = await apiExportWeights(token)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = "standard_weights.csv"; a.click()
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
      const result = await apiImportWeights(token, rows)
      setImportResult(result)
      await load(search || undefined)
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
          <div className="flex size-9 items-center justify-center rounded-lg bg-teal-500/10">
            <Scale className="size-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Standard Weights</h1>
            <p className="text-xs text-muted-foreground">
              Reference calibration weights — GMP master data
            </p>
          </div>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <ImportBanner result={importResult} onClose={() => setImportResult(null)} />
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
          <button className="ml-auto" onClick={() => setError(null)}><X className="size-4" /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by serial no, weight, material…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Button variant="outline" size="sm" onClick={() => load(search || undefined)} disabled={loading}>
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
          <Plus className="size-4 mr-1.5" /> Add Weight
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
            <Scale className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search ? "No weights match your search." : "No standard weights yet. Add one to get started."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left w-12">S.No</th>
                <th className="px-4 py-3 text-left">Std Weight S/N</th>
                <th className="px-4 py-3 text-left">Standard Weight</th>
                <th className="px-4 py-3 text-left">Last Calibrated On</th>
                <th className="px-4 py-3 text-left">Next Calibration Due</th>
                <th className="px-4 py-3 text-left">Tolerance Limit</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  {deleteItem?.id === item.id ? (
                    <td colSpan={8} className="px-4 py-3">
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
                      <td className="px-4 py-3 font-mono font-medium">{item.weightSerialNo}</td>
                      <td className="px-4 py-3 font-medium">{item.standardWeight}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.lastCalibratedOn
                          ? new Date(item.lastCalibratedOn).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <CalibrationBadge dueDate={item.nextCalibrationDue} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {item.toleranceLimit ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge isActive={item.isActive} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="icon" className="size-8"
                            onClick={() => setEditItem(item)}
                          >
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

      {/* Count footer */}
      {!loading && items.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {items.length} weight{items.length !== 1 ? "s" : ""} total
        </p>
      )}

      {/* Dialogs */}
      <AddWeightDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(item) => setItems((prev) => [...prev, item])}
      />

      <EditWeightDialog
        open={!!editItem}
        item={editItem}
        onClose={() => setEditItem(null)}
        onUpdated={(updated) =>
          setItems((prev) => prev.map((x) => x.id === updated.id ? updated : x))
        }
      />
    </div>
  )
}
