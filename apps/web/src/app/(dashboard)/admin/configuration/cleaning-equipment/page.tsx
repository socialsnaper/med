"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/useAuth"
import {
  apiListCleaningEquipment,
  apiDeleteCleaningEquipment,
  apiExportCleaningEquipment,
  apiImportCleaningEquipment,
  type CleaningEquipmentItem,
  type ImportRow,
  CLEANING_TYPES,
  ApiError,
} from "@/lib/auth/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AddCleaningEquipmentDialog } from "./AddCleaningEquipmentDialog"
import { EditCleaningEquipmentDialog } from "./EditCleaningEquipmentDialog"
import {
  Sparkles, ChevronLeft, Plus, Pencil, Trash2, Search,
  Loader2, AlertCircle, CheckCircle2, XCircle, Download,
  Upload, RefreshCw, X,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Type display helpers ───────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  dry:        "bg-amber-50 text-amber-700 ring-amber-200",
  wet:        "bg-blue-50 text-blue-700 ring-blue-200",
  sanitizing: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  general:    "bg-slate-50 text-slate-600 ring-slate-200",
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 capitalize",
      TYPE_COLORS[type] ?? TYPE_COLORS.general,
    )}>
      {type}
    </span>
  )
}

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

// ── CSV template ──────────────────────────────────────────────────────────────

const CSV_TEMPLATE = [
  "equipment_name,equipment_details,cleaning_type,material,requires_replacement,replacement_interval_days,display_order",
  "Mop,Used for wet floor cleaning,wet,Microfiber,true,30,1",
  "Hand Brush,Dry sweeping brush,dry,Nylon bristles,true,60,2",
].join("\n")

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = "cleaning_equipment_template.csv"; a.click()
  URL.revokeObjectURL(url)
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCsv(text: string): ImportRow[] {
  const lines  = text.trim().split(/\r?\n/)
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
  return lines.slice(1).map((line) => {
    const cols: Record<string, string> = {}
    line.split(",").forEach((v, i) => { cols[header[i] ?? `col${i}`] = v.trim().replace(/^"|"$/g, "") })
    const row: ImportRow = { equipmentName: cols["equipment_name"] ?? "" }
    if (cols["equipment_details"])        row.equipmentDetails        = cols["equipment_details"]
    if (cols["cleaning_type"])            row.cleaningType            = cols["cleaning_type"] as ImportRow["cleaningType"]
    if (cols["material"])                 row.material                = cols["material"]
    if (cols["requires_replacement"])     row.requiresReplacement     = cols["requires_replacement"]
    if (cols["replacement_interval_days"]) row.replacementIntervalDays = Number(cols["replacement_interval_days"]) || null
    if (cols["display_order"])            row.displayOrder            = Number(cols["display_order"]) || 0
    return row
  }).filter((r) => r.equipmentName)
}

// ── Delete confirmation ────────────────────────────────────────────────────────

function DeleteConfirm({
  item, onConfirm, onCancel, isDeleting,
}: {
  item: CleaningEquipmentItem
  onConfirm: () => void
  onCancel:  () => void
  isDeleting: boolean
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <p className="text-sm font-medium text-destructive">
        Delete <span className="font-mono">{item.equipmentCode}</span> — {item.equipmentName}?
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
        {result.errors.length > 0 && (
          <span className="text-destructive">✗ {result.errors.length} errors</span>
        )}
      </div>
      {result.errors.length > 0 && (
        <ul className="text-xs text-destructive space-y-0.5 max-h-24 overflow-auto">
          {result.errors.map((e, i) => (
            <li key={i}>Row {e.row}: {e.message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CleaningEquipmentPage() {
  const { user, getAccessToken } = useAuth()
  const router = useRouter()

  const [items,        setItems]        = useState<CleaningEquipmentItem[]>([])
  const [isLoading,    setIsLoading]    = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [search,       setSearch]       = useState("")
  const [activeType,   setActiveType]   = useState("")
  const [addOpen,      setAddOpen]      = useState(false)
  const [editItem,     setEditItem]     = useState<CleaningEquipmentItem | null>(null)
  const [deleteId,     setDeleteId]     = useState<string | null>(null)
  const [isDeleting,   setIsDeleting]   = useState(false)
  const [deleteError,  setDeleteError]  = useState<string | null>(null)
  const [isExporting,  setIsExporting]  = useState(false)
  const [isImporting,  setIsImporting]  = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: { row: number; message: string }[] } | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Role guard
  useEffect(() => {
    if (user && user.role !== "System Administrator" && user.role !== "User Admin") {
      router.replace("/admin")
    }
  }, [user, router])

  const load = useCallback(
    async (q?: string, t?: string) => {
      const token = getAccessToken()
      if (!token) return
      setIsLoading(true); setError(null)
      try {
        setItems(await apiListCleaningEquipment(token, q, t))
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load cleaning equipment")
      } finally {
        setIsLoading(false)
      }
    },
    [getAccessToken],
  )

  useEffect(() => { load() }, [load])

  function handleSearch(value: string) {
    setSearch(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(
      () => load(value.trim() || undefined, activeType || undefined), 350,
    )
  }

  function handleTypeFilter(t: string) {
    setActiveType(t)
    load(search.trim() || undefined, t || undefined)
  }

  async function handleDelete(id: string) {
    const token = getAccessToken()
    if (!token) return
    setIsDeleting(true); setDeleteError(null)
    try {
      await apiDeleteCleaningEquipment(token, id)
      setItems((prev) => prev.filter((i) => i.id !== id))
      setDeleteId(null)
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleExport() {
    const token = getAccessToken()
    if (!token) return
    setIsExporting(true)
    try {
      const blob = await apiExportCleaningEquipment(token)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = "cleaning_equipment.csv"; a.click()
      URL.revokeObjectURL(url)
    } catch { /* silent */ } finally {
      setIsExporting(false)
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    const token = getAccessToken()
    if (!token) return

    const text = await file.text()
    const rows = parseCsv(text)
    if (!rows.length) { setDeleteError("No valid rows found in the CSV file."); return }

    setIsImporting(true)
    try {
      const result = await apiImportCleaningEquipment(token, rows)
      setImportResult(result)
      if (result.created > 0) load(search.trim() || undefined, activeType || undefined)
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Import failed")
    } finally {
      setIsImporting(false)
    }
  }

  if (!user) return null

  const TYPE_LABELS: Record<string, string> = {
    dry: "Dry", wet: "Wet", sanitizing: "Sanitizing", general: "General",
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/configuration"
          className="flex items-center justify-center size-8 rounded-lg border hover:bg-accent transition-colors"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-500/10">
          <Sparkles className="size-5 text-sky-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cleaning Equipment</h1>
          <p className="text-sm text-muted-foreground">Manage cleaning tools used in room and equipment SOPs</p>
        </div>
      </div>

      {/* ── Import result banner ── */}
      {importResult && (
        <ImportBanner result={importResult} onClose={() => setImportResult(null)} />
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by code, name or material…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {/* Cleaning type filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => handleTypeFilter("")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              activeType === "" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            All
          </button>
          {CLEANING_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => handleTypeFilter(t)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize",
                activeType === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={downloadTemplate} title="Download CSV template">
            <Download className="mr-1.5 size-3.5" /> Template
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            title="Import from CSV"
          >
            {isImporting
              ? <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              : <Upload className="mr-1.5 size-3.5" />}
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <Button
            variant="outline" size="sm"
            onClick={handleExport}
            disabled={isExporting}
            title="Export to CSV"
          >
            {isExporting
              ? <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              : <RefreshCw className="mr-1.5 size-3.5" />}
            Export
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 size-4" /> Add Equipment
          </Button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {deleteError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {deleteError}
          <button className="ml-auto" onClick={() => setDeleteError(null)}><X className="size-4" /></button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-destructive">
            <AlertCircle className="size-4" /> {error}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Sparkles className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search || activeType ? "No equipment matches your filter." : "No cleaning equipment added yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground w-24">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Details</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground w-28 hidden sm:table-cell">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Material</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground w-32 hidden sm:table-cell">Replacement</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground w-24">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <>
                    <tr
                      key={item.id}
                      className={cn(
                        "hover:bg-muted/30 transition-colors",
                        deleteId === item.id && "bg-destructive/5",
                      )}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.equipmentCode}</td>
                      <td className="px-4 py-3 font-medium">{item.equipmentName}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell max-w-xs truncate">
                        {item.equipmentDetails ?? <span className="italic text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell"><TypeBadge type={item.cleaningType} /></td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                        {item.material ?? <span className="italic text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        {item.requiresReplacement ? (
                          <span className="text-xs text-amber-600">
                            Every {item.replacementIntervalDays ?? "?"} days
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center"><StatusBadge isActive={item.isActive} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon" variant="ghost" className="size-8"
                            onClick={() => { setDeleteId(null); setEditItem(item) }}
                            title="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost"
                            className="size-8 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => { setDeleteId(deleteId === item.id ? null : item.id); setDeleteError(null) }}
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {deleteId === item.id && (
                      <tr key={`${item.id}-confirm`}>
                        <td colSpan={8} className="px-4 pb-3">
                          <DeleteConfirm
                            item={item}
                            onConfirm={() => handleDelete(item.id)}
                            onCancel={() => { setDeleteId(null); setDeleteError(null) }}
                            isDeleting={isDeleting}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {!isLoading && !error && `${items.length} item${items.length !== 1 ? "s" : ""}`}
      </p>

      {/* ── Dialogs ── */}
      <AddCleaningEquipmentDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(item) =>
          setItems((prev) => [...prev, item].sort(
            (a, b) => a.displayOrder - b.displayOrder || a.equipmentName.localeCompare(b.equipmentName),
          ))
        }
      />
      <EditCleaningEquipmentDialog
        item={editItem}
        onClose={() => setEditItem(null)}
        onUpdated={(updated) =>
          setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
        }
      />
    </div>
  )
}
