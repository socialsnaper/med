"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/useAuth"
import {
  apiListRoomCleaningSopSteps,
  apiDeleteRoomCleaningSopStep,
  apiExportRoomCleaningSopSteps,
  apiImportRoomCleaningSopSteps,
  apiListRoomCleaningTypes,
  type RoomCleaningSopStepItem,
  type RoomCleaningTypeItem,
  type SopStepImportRow,
  SOP_CLEANING_METHODS,
  SOP_EQUIP_SEQUENCES,
  ApiError,
} from "@/lib/auth/api"
import { Button } from "@/components/ui/button"
import { AddSopStepDialog } from "./AddSopStepDialog"
import { EditSopStepDialog } from "./EditSopStepDialog"
import {
  Sparkles, ChevronLeft, Plus, Pencil, Trash2,
  Loader2, AlertCircle, CheckCircle2, XCircle, Download,
  Upload, RefreshCw, X, ClipboardList,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Badges ────────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  TypeA: "bg-amber-50 text-amber-700 ring-amber-200",
  TypeB: "bg-blue-50 text-blue-700 ring-blue-200",
  TypeC: "bg-emerald-50 text-emerald-700 ring-emerald-200",
}
const METHOD_LABELS: Record<string, string> = { TypeA: "Dry", TypeB: "Wet", TypeC: "San" }

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  pending:  "bg-amber-50 text-amber-700 ring-amber-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  archived: "bg-slate-100 text-slate-500 ring-slate-200",
}

function MethodBadge({ method }: { method: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1", METHOD_COLORS[method] ?? "bg-slate-50 text-slate-600 ring-slate-200")}>
      {METHOD_LABELS[method] ?? method}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const Icon = status === "approved" ? CheckCircle2 : status === "rejected" ? XCircle : null
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 capitalize", STATUS_COLORS[status] ?? "bg-slate-50 text-slate-600 ring-slate-200")}>
      {Icon && <Icon className="size-3" />} {status}
    </span>
  )
}

// ── CSV template ──────────────────────────────────────────────────────────────

const CSV_TEMPLATE = [
  "cleaning_type_code,step_number,time_allotted,cleaning_method,equipment_cleaning_sequence,procedure_text,chemical_used",
  "RCT-001,1,00:05,TypeB,Before,Remove loose material using hand brush and dust pan.,NA",
  "RCT-001,2,00:10,TypeB,Before,Apply detergent solution to floor using mop.,Detergent Solution",
].join("\n")

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = "room_cleaning_sop_steps_template.csv"; a.click()
  URL.revokeObjectURL(url)
}

function parseCsv(text: string): SopStepImportRow[] {
  const lines  = text.trim().split(/\r?\n/)
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"))
  return lines.slice(1).map((line) => {
    const cols: Record<string, string> = {}
    line.split(",").forEach((v, i) => { cols[header[i] ?? `col${i}`] = v.trim().replace(/^"|"$/g, "") })
    const cm = cols["cleaning_method"]
    const es = cols["equipment_cleaning_sequence"]
    return {
      cleaningTypeCode:          cols["cleaning_type_code"] ?? "",
      stepNumber:                parseInt(cols["step_number"] ?? "0", 10) || 0,
      timeAllottedDisplay:       cols["time_allotted"] || undefined,
      cleaningMethod:            (SOP_CLEANING_METHODS as readonly string[]).includes(cm) ? cm as typeof SOP_CLEANING_METHODS[number] : "TypeB",
      equipmentCleaningSequence: (SOP_EQUIP_SEQUENCES as readonly string[]).includes(es) ? es as typeof SOP_EQUIP_SEQUENCES[number] : undefined,
      procedureText:             cols["procedure_text"] ?? "",
      chemicalUsed:              cols["chemical_used"] || undefined,
    }
  }).filter((r) => r.cleaningTypeCode && r.stepNumber > 0 && r.procedureText)
}

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({
  item, onConfirm, onCancel, isDeleting,
}: {
  item: RoomCleaningSopStepItem; onConfirm: () => void; onCancel: () => void; isDeleting: boolean
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <p className="text-sm font-medium text-destructive">
        Delete Step {item.stepNumber} of {item.cleaningTypeName}?
      </p>
      <p className="text-xs text-muted-foreground">S.No will be renumbered automatically.</p>
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

export default function RoomCleaningSopPage() {
  const { user, getAccessToken } = useAuth()
  const router = useRouter()

  const [steps,          setSteps]          = useState<RoomCleaningSopStepItem[]>([])
  const [cleaningTypes,  setCleaningTypes]  = useState<RoomCleaningTypeItem[]>([])
  const [isLoading,      setIsLoading]      = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [activeTypeId,   setActiveTypeId]   = useState<string>("")
  const [addOpen,        setAddOpen]        = useState(false)
  const [editStep,       setEditStep]       = useState<RoomCleaningSopStepItem | null>(null)
  const [deleteId,       setDeleteId]       = useState<string | null>(null)
  const [isDeleting,     setIsDeleting]     = useState(false)
  const [actionError,    setActionError]    = useState<string | null>(null)
  const [isExporting,    setIsExporting]    = useState(false)
  const [isImporting,    setIsImporting]    = useState(false)
  const [importResult,   setImportResult]   = useState<{ created: number; skipped: number; errors: { row: number; message: string }[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user && user.role !== "System Administrator" && user.role !== "User Admin") {
      router.replace("/admin")
    }
  }, [user, router])

  // Load cleaning types for filter and dialogs
  const loadTypes = useCallback(async () => {
    const token = getAccessToken()
    if (!token) return
    try {
      setCleaningTypes(await apiListRoomCleaningTypes(token))
    } catch { /* silent */ }
  }, [getAccessToken])

  const load = useCallback(async (typeId?: string) => {
    const token = getAccessToken()
    if (!token) return
    setIsLoading(true); setError(null)
    try {
      setSteps(await apiListRoomCleaningSopSteps(token, typeId || undefined))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load SOP steps")
    } finally {
      setIsLoading(false)
    }
  }, [getAccessToken])

  useEffect(() => {
    loadTypes()
    load()
  }, [loadTypes, load])

  function handleTypeFilter(typeId: string) {
    setActiveTypeId(typeId)
    load(typeId || undefined)
  }

  async function handleDelete(id: string) {
    const token = getAccessToken()
    if (!token) return
    setIsDeleting(true); setActionError(null)
    try {
      await apiDeleteRoomCleaningSopStep(token, id)
      // Reload to pick up renumbered slids
      await load(activeTypeId || undefined)
      setDeleteId(null)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleExport() {
    const token = getAccessToken()
    if (!token) return
    setIsExporting(true)
    try {
      const blob = await apiExportRoomCleaningSopSteps(token, activeTypeId || undefined)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href = url; a.download = "room_cleaning_sop_steps.csv"; a.click()
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
    if (!rows.length) { setActionError("No valid rows found in the CSV file."); return }
    setIsImporting(true)
    try {
      const result = await apiImportRoomCleaningSopSteps(token, rows)
      setImportResult(result)
      if (result.created > 0) load(activeTypeId || undefined)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Import failed")
    } finally { setIsImporting(false) }
  }

  if (!user) return null

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/configuration/room-sop"
          className="flex items-center justify-center size-8 rounded-lg border hover:bg-accent transition-colors"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-500/10">
          <ClipboardList className="size-5 text-sky-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Room Cleaning SOP</h1>
          <p className="text-sm text-muted-foreground">Manage SOP steps for each room cleaning type</p>
        </div>
      </div>

      {/* ── Import banner ── */}
      {importResult && <ImportBanner result={importResult} onClose={() => setImportResult(null)} />}

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Cleaning type filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => handleTypeFilter("")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              activeTypeId === "" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            All Types
          </button>
          {cleaningTypes.map((ct) => (
            <button
              key={ct.id}
              onClick={() => handleTypeFilter(ct.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                activeTypeId === ct.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {ct.cleaningTypeName}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
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
          <Button onClick={() => setAddOpen(true)} disabled={cleaningTypes.length === 0}>
            <Plus className="mr-1.5 size-4" /> Add Step
          </Button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {actionError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {actionError}
          <button className="ml-auto" onClick={() => setActionError(null)}><X className="size-4" /></button>
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
        ) : steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <ClipboardList className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {activeTypeId ? "No SOP steps for this cleaning type." : "No SOP steps added yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground w-12">S.No</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Cleaning Type</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground w-16">Step</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Dry/Wet/San</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Before/After</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Procedure</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Chemical Used</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {steps.map((step) => (
                  <tr key={step.id} className="hover:bg-muted/20 transition-colors align-top">
                    <td className="px-4 py-3 text-right text-muted-foreground font-mono text-xs">{step.slid}</td>
                    <td className="px-4 py-3 text-xs font-medium whitespace-nowrap">{step.cleaningTypeName}</td>
                    <td className="px-4 py-3 text-right font-medium">{step.stepNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap font-mono text-xs">
                      {step.timeAllottedDisplay ?? "—"}
                    </td>
                    <td className="px-4 py-3"><MethodBadge method={step.cleaningMethod} /></td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1",
                        step.equipmentCleaningSequence === "Before"
                          ? "bg-orange-50 text-orange-700 ring-orange-200"
                          : step.equipmentCleaningSequence === "After"
                            ? "bg-sky-50 text-sky-700 ring-sky-200"
                            : "bg-slate-50 text-slate-500 ring-slate-200",
                      )}>
                        {step.equipmentCleaningSequence}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="line-clamp-2 text-xs">{step.procedureText}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {step.chemicalUsed ?? "—"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={step.status} /></td>
                    <td className="px-4 py-3">
                      {deleteId === step.id ? (
                        <DeleteConfirm
                          item={step}
                          onConfirm={() => handleDelete(step.id)}
                          onCancel={() => setDeleteId(null)}
                          isDeleting={isDeleting}
                        />
                      ) : (
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            size="icon" variant="ghost" className="size-7"
                            onClick={() => setEditStep(step)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(step.id)}
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

      <AddSopStepDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(step) => {
          setSteps((prev) => [...prev, step].sort((a, b) => a.stepNumber - b.stepNumber))
        }}
        cleaningTypes={cleaningTypes}
        defaultTypeId={activeTypeId || undefined}
      />

      <EditSopStepDialog
        item={editStep}
        onClose={() => setEditStep(null)}
        onUpdated={(updated) => setSteps((prev) => prev.map((s) => s.id === updated.id ? updated : s))}
      />
    </div>
  )
}
