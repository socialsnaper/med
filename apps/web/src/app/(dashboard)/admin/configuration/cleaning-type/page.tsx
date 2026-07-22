"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/useAuth"
import {
  apiListRoomCleaningTypes,
  apiDeleteRoomCleaningType,
  apiExportRoomCleaningTypes,
  apiImportRoomCleaningTypes,
  type RoomCleaningTypeItem,
  type RoomCleaningTypeImportRow,
  ROOM_CLEANING_DEFAULT_METHODS,
  ApiError,
} from "@/lib/auth/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AddCleaningTypeDialog } from "./AddCleaningTypeDialog"
import { EditCleaningTypeDialog } from "./EditCleaningTypeDialog"
import {
  Droplets, ChevronLeft, Plus, Pencil, Trash2, Search,
  Loader2, AlertCircle, CheckCircle2, XCircle, Download,
  Upload, RefreshCw, X,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Method badge ──────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  TypeA: "bg-amber-50 text-amber-700 ring-amber-200",
  TypeB: "bg-blue-50 text-blue-700 ring-blue-200",
  TypeC: "bg-emerald-50 text-emerald-700 ring-emerald-200",
}
const METHOD_LABELS: Record<string, string> = {
  TypeA: "Dry (A)",
  TypeB: "Wet (B)",
  TypeC: "San (C)",
}

function MethodBadge({ method }: { method: string | null }) {
  if (!method) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1",
      METHOD_COLORS[method] ?? "bg-slate-50 text-slate-600 ring-slate-200",
    )}>
      {METHOD_LABELS[method] ?? method}
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
  "cleaning_type_name,cleaning_type_details,default_method,display_order",
  "Area Cleaning,General area cleaning of room surfaces,TypeB,1",
  "Deep Cleaning,Thorough cleaning of all room surfaces,TypeB,2",
].join("\n")

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = "cleaning_types_template.csv"; a.click()
  URL.revokeObjectURL(url)
}

function parseCsv(text: string): RoomCleaningTypeImportRow[] {
  const lines  = text.trim().split(/\r?\n/)
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"))
  return lines.slice(1).map((line) => {
    const cols: Record<string, string> = {}
    line.split(",").forEach((v, i) => { cols[header[i] ?? `col${i}`] = v.trim().replace(/^"|"$/g, "") })
    const row: RoomCleaningTypeImportRow = { cleaningTypeName: cols["cleaning_type_name"] ?? "" }
    if (cols["cleaning_type_details"]) row.cleaningTypeDetails = cols["cleaning_type_details"]
    const dm = cols["default_method"]
    if (dm && (ROOM_CLEANING_DEFAULT_METHODS as readonly string[]).includes(dm))
      row.defaultMethod = dm as typeof ROOM_CLEANING_DEFAULT_METHODS[number]
    if (cols["display_order"]) row.displayOrder = Number(cols["display_order"]) || 0
    return row
  }).filter((r) => r.cleaningTypeName)
}

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({
  item, onConfirm, onCancel, isDeleting,
}: {
  item: RoomCleaningTypeItem; onConfirm: () => void; onCancel: () => void; isDeleting: boolean
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <p className="text-sm font-medium text-destructive">
        Delete <span className="font-mono">{item.cleaningTypeCode}</span> — {item.cleaningTypeName}?
      </p>
      <p className="text-xs text-muted-foreground">This cannot be undone. Fails if SOP steps are linked.</p>
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
          {result.errors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
        </ul>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CleaningTypePage() {
  const { user, getAccessToken } = useAuth()
  const router = useRouter()

  const [items,        setItems]        = useState<RoomCleaningTypeItem[]>([])
  const [isLoading,    setIsLoading]    = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [search,       setSearch]       = useState("")
  const [addOpen,      setAddOpen]      = useState(false)
  const [editItem,     setEditItem]     = useState<RoomCleaningTypeItem | null>(null)
  const [deleteId,     setDeleteId]     = useState<string | null>(null)
  const [isDeleting,   setIsDeleting]   = useState(false)
  const [deleteError,  setDeleteError]  = useState<string | null>(null)
  const [isExporting,  setIsExporting]  = useState(false)
  const [isImporting,  setIsImporting]  = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: { row: number; message: string }[] } | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user && user.role !== "System Administrator" && user.role !== "User Admin") {
      router.replace("/admin")
    }
  }, [user, router])

  const load = useCallback(async (q?: string) => {
    const token = getAccessToken()
    if (!token) return
    setIsLoading(true); setError(null)
    try {
      setItems(await apiListRoomCleaningTypes(token, q))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load cleaning types")
    } finally {
      setIsLoading(false)
    }
  }, [getAccessToken])

  useEffect(() => { load() }, [load])

  function handleSearch(value: string) {
    setSearch(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => load(value.trim() || undefined), 350)
  }

  async function handleDelete(id: string) {
    const token = getAccessToken()
    if (!token) return
    setIsDeleting(true); setDeleteError(null)
    try {
      await apiDeleteRoomCleaningType(token, id)
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
      const blob = await apiExportRoomCleaningTypes(token)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = "room_cleaning_types.csv"; a.click()
      URL.revokeObjectURL(url)
    } catch { /* silent */ } finally { setIsExporting(false) }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    const token = getAccessToken()
    if (!token) return
    const rows = parseCsv(await file.text())
    if (!rows.length) { setDeleteError("No valid rows found in the CSV file."); return }
    setIsImporting(true)
    try {
      const result = await apiImportRoomCleaningTypes(token, rows)
      setImportResult(result)
      if (result.created > 0) load(search.trim() || undefined)
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Import failed")
    } finally { setIsImporting(false) }
  }

  if (!user) return null

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
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-400/10">
          <Droplets className="size-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cleaning Type</h1>
          <p className="text-sm text-muted-foreground">Manage room cleaning types used in SOP procedures</p>
        </div>
      </div>

      {/* ── Import banner ── */}
      {importResult && (
        <ImportBanner result={importResult} onClose={() => setImportResult(null)} />
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by code or name…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={downloadTemplate} title="Download CSV template">
            <Download className="mr-1.5 size-3.5" /> Template
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            {isImporting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Upload className="mr-1.5 size-3.5" />}
            Import
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 size-3.5" />}
            Export
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 size-4" /> Add Cleaning Type
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
            <Droplets className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search ? "No cleaning types match your search." : "No cleaning types added yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Code</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Details</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Default Method</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Order</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {item.cleaningTypeCode}
                    </td>
                    <td className="px-4 py-3 font-medium">{item.cleaningTypeName}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                      {item.cleaningTypeDetails ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <MethodBadge method={item.defaultMethod} />
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{item.displayOrder}</td>
                    <td className="px-4 py-3"><StatusBadge isActive={item.isActive} /></td>
                    <td className="px-4 py-3">
                      {deleteId === item.id ? (
                        <DeleteConfirm
                          item={item}
                          onConfirm={() => handleDelete(item.id)}
                          onCancel={() => setDeleteId(null)}
                          isDeleting={isDeleting}
                        />
                      ) : (
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            size="icon" variant="ghost" className="size-7"
                            onClick={() => setEditItem(item)}
                            title="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(item.id)}
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddCleaningTypeDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(item) => setItems((prev) => [item, ...prev])}
      />

      <EditCleaningTypeDialog
        item={editItem}
        onClose={() => setEditItem(null)}
        onUpdated={(updated) => setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i))}
      />
    </div>
  )
}
