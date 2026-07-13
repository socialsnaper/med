"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/useAuth"
import {
  apiListFunctionTypes,
  apiDeleteFunctionType,
  apiExportFunctionTypes,
  apiImportFunctionTypes,
  type FunctionTypeItem,
  type FunctionTypeImportRow,
  type ImportResult,
  ApiError,
} from "@/lib/auth/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AddFunctionTypeDialog } from "./AddFunctionTypeDialog"
import { EditFunctionTypeDialog } from "./EditFunctionTypeDialog"
import {
  Code2,
  ChevronLeft,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Download,
  Upload,
  X,
  Check,
  Minus,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── CSV template ───────────────────────────────────────────────────────────────

const CSV_TEMPLATE = [
  "function_type_name,function_type_details,can_sign_off,can_operate_batch,can_perform_cleaning,can_perform_maintenance,display_order",
  "Supervision,Overseeing and guiding activities,true,false,false,false,1",
  "Operation,Executing core production activities,false,true,false,false,2",
  "QC,Quality control and verification,true,false,false,false,3",
].join("\n")

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = "function_types_template.csv"; a.click()
  URL.revokeObjectURL(url)
}

function parseCsv(text: string): FunctionTypeImportRow[] {
  const lines  = text.trim().split(/\r?\n/)
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
  return lines.slice(1).map((line) => {
    const cols: Record<string, string> = {}
    line.split(",").forEach((v, i) => { cols[header[i] ?? `col${i}`] = v.trim().replace(/^"|"$/g, "") })
    const row: FunctionTypeImportRow = { functionTypeName: cols["function_type_name"] ?? "" }
    if (cols["function_type_details"])   row.functionTypeDetails   = cols["function_type_details"]
    if (cols["can_sign_off"])            row.canSignOff            = cols["can_sign_off"] === "true"
    if (cols["can_operate_batch"])       row.canOperateBatch       = cols["can_operate_batch"] === "true"
    if (cols["can_perform_cleaning"])    row.canPerformCleaning    = cols["can_perform_cleaning"] === "true"
    if (cols["can_perform_maintenance"]) row.canPerformMaintenance = cols["can_perform_maintenance"] === "true"
    if (cols["display_order"])           row.displayOrder          = Number(cols["display_order"]) || 0
    return row
  }).filter((r) => r.functionTypeName)
}

function ImportBanner({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Import complete</p>
        <button onClick={onClose}><X className="size-4 text-muted-foreground" /></button>
      </div>
      <div className="flex gap-4 text-sm">
        <span className="text-emerald-600">✓ {result.created} created</span>
        <span className="text-amber-600">⊖ {result.skipped} skipped (duplicates)</span>
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

// ── Capability cell ────────────────────────────────────────────────────────────

function Cap({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center justify-center size-5 rounded-full bg-emerald-50 ring-1 ring-emerald-200">
      <Check className="size-3 text-emerald-600" strokeWidth={2.5} />
    </span>
  ) : (
    <span className="inline-flex items-center justify-center size-5 rounded-full bg-muted ring-1 ring-border">
      <Minus className="size-3 text-muted-foreground" strokeWidth={2} />
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

// ── Delete confirmation ────────────────────────────────────────────────────────

function DeleteConfirm({
  item, onConfirm, onCancel, isDeleting,
}: {
  item: FunctionTypeItem; onConfirm: () => void; onCancel: () => void; isDeleting: boolean
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <p className="text-sm font-medium text-destructive">
        Delete <span className="font-mono">{item.functionTypeId}</span> — {item.functionTypeName}?
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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function FunctionTypePage() {
  const { user, getAccessToken } = useAuth()
  const router = useRouter()

  const [items,        setItems]        = useState<FunctionTypeItem[]>([])
  const [isLoading,    setIsLoading]    = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [search,       setSearch]       = useState("")
  const [addOpen,      setAddOpen]      = useState(false)
  const [editItem,     setEditItem]     = useState<FunctionTypeItem | null>(null)
  const [deleteId,     setDeleteId]     = useState<string | null>(null)
  const [isDeleting,   setIsDeleting]   = useState(false)
  const [deleteError,  setDeleteError]  = useState<string | null>(null)
  const [isExporting,  setIsExporting]  = useState(false)
  const [isImporting,  setIsImporting]  = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const searchTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user && user.role !== "System Administrator" && user.role !== "User Admin") {
      router.replace("/admin")
    }
  }, [user, router])

  const load = useCallback(
    async (q?: string) => {
      const token = getAccessToken(); if (!token) return
      setIsLoading(true); setError(null)
      try {
        setItems(await apiListFunctionTypes(token, q))
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load function types")
      } finally { setIsLoading(false) }
    },
    [getAccessToken],
  )

  useEffect(() => { load() }, [load])

  function handleSearch(value: string) {
    setSearch(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => load(value.trim() || undefined), 350)
  }

  async function handleDelete(id: string) {
    const token = getAccessToken(); if (!token) return
    setIsDeleting(true); setDeleteError(null)
    try {
      await apiDeleteFunctionType(token, id)
      setItems((prev) => prev.filter((i) => i.id !== id))
      setDeleteId(null)
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Delete failed")
    } finally { setIsDeleting(false) }
  }

  async function handleExport() {
    const token = getAccessToken(); if (!token) return
    setIsExporting(true)
    try {
      const blob = await apiExportFunctionTypes(token)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = "function_types.csv"; a.click()
      URL.revokeObjectURL(url)
    } catch { /* silent */ } finally { setIsExporting(false) }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ""
    const token = getAccessToken(); if (!token) return
    const rows  = parseCsv(await file.text())
    if (!rows.length) { setDeleteError("No valid rows found in the CSV file."); return }
    setIsImporting(true)
    try {
      const result = await apiImportFunctionTypes(token, rows)
      setImportResult(result)
      if (result.created > 0) load(search.trim() || undefined)
    } catch (err) { setDeleteError(err instanceof ApiError ? err.message : "Import failed") }
    finally { setIsImporting(false) }
  }

  if (!user) return null

  const deleteItem = deleteId ? items.find((i) => i.id === deleteId) ?? null : null

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
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10">
          <Code2 className="size-5 text-cyan-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Function Types</h1>
          <p className="text-sm text-muted-foreground">
            Manage job function categories and their operational capabilities
          </p>
        </div>
      </div>

      {importResult && <ImportBanner result={importResult} onClose={() => setImportResult(null)} />}

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by ID or name…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={downloadTemplate} title="Download CSV template">
            <Download className="mr-1.5 size-3.5" /> Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            {isImporting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Upload className="mr-1.5 size-3.5" />}
            Import
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Download className="mr-1.5 size-3.5" />}
            Export
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 size-4" /> Add Function Type
          </Button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {deleteError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {deleteError}
          <button className="ml-auto" onClick={() => setDeleteError(null)}><X className="size-4" /></button>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteItem && (
        <DeleteConfirm
          item={deleteItem}
          onConfirm={() => handleDelete(deleteItem.id)}
          onCancel={() => setDeleteId(null)}
          isDeleting={isDeleting}
        />
      )}

      {/* ── Table ── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-16 text-destructive">
            <AlertCircle className="size-6" />
            <p className="text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={() => load()}>Retry</Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Code2 className="size-8 opacity-30" />
            <p className="text-sm">No function types found</p>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 size-3.5" /> Add your first
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground w-8">#</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Sign Off</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Batch Ops</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Cleaning</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Maintenance</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={cn(
                      "hover:bg-muted/30 transition-colors",
                      deleteId === item.id && "opacity-50",
                    )}
                  >
                    <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs font-medium">{item.functionTypeId}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.functionTypeName}</p>
                      {item.functionTypeDetails && (
                        <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                          {item.functionTypeDetails}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center"><Cap value={item.canSignOff} /></td>
                    <td className="px-4 py-3 text-center"><Cap value={item.canOperateBatch} /></td>
                    <td className="px-4 py-3 text-center"><Cap value={item.canPerformCleaning} /></td>
                    <td className="px-4 py-3 text-center"><Cap value={item.canPerformMaintenance} /></td>
                    <td className="px-4 py-3"><StatusBadge isActive={item.isActive} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="icon" className="size-7"
                          onClick={() => setEditItem(item)} title="Edit"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => { setDeleteId(item.id); setDeleteError(null) }} title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isLoading && items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {items.length} function type{items.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* ── Dialogs ── */}
      <AddFunctionTypeDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(item) => {
          setItems((prev) =>
            [...prev, item].sort((a, b) => a.displayOrder - b.displayOrder || a.functionTypeName.localeCompare(b.functionTypeName))
          )
          setAddOpen(false)
        }}
      />
      <EditFunctionTypeDialog
        item={editItem}
        onClose={() => setEditItem(null)}
        onUpdated={(updated) => {
          setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i))
          setEditItem(null)
        }}
      />
    </div>
  )
}
