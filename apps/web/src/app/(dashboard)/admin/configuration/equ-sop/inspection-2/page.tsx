"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/useAuth"
import {
  apiListEquInsp2SopSteps, apiDeleteEquInsp2SopStep,
  apiExportEquInsp2SopSteps, apiImportEquInsp2SopSteps,
  apiListRoomCleaningTypes,
  type EquInsp2SopStepItem, type RoomCleaningTypeItem, type EquInsp2MediaItem, ApiError,
} from "@/lib/auth/api"
import { Button } from "@/components/ui/button"
import { AddEquInsp2SopStepDialog }   from "./AddEquInsp2SopStepDialog"
import { EditEquInsp2SopStepDialog }  from "./EditEquInsp2SopStepDialog"
import { ManagePicturesDialog }       from "./ManagePicturesDialog"
import {
  ClipboardCheck, ChevronLeft, Plus, Pencil, Trash2,
  Loader2, AlertCircle, CheckCircle2, XCircle,
  Download, Upload, RefreshCw, X, ImageIcon, Camera,
} from "lucide-react"
import { cn } from "@/lib/utils"

type ImportRow = { cleaningTypeCode: string; stepNumber: number; procedureText: string }

const STATUS_COLORS: Record<string, string> = { approved: "bg-emerald-50 text-emerald-700 ring-emerald-200", pending: "bg-amber-50 text-amber-700 ring-amber-200", rejected: "bg-red-50 text-red-700 ring-red-200", archived: "bg-slate-100 text-slate-500 ring-slate-200" }
function StatusBadge({ status }: { status: string }) { const Icon = status === "approved" ? CheckCircle2 : status === "rejected" ? XCircle : null; return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 capitalize", STATUS_COLORS[status] ?? "bg-slate-50 text-slate-600 ring-slate-200")}>{Icon && <Icon className="size-3" />} {status}</span> }
function Thumb({ url }: { url: string }) { const [b, setB] = useState(false); if (b) return <div className="w-12 h-10 flex items-center justify-center bg-muted rounded border"><ImageIcon className="size-4 text-muted-foreground/40" /></div>; return <img src={url} alt="" className="w-12 h-10 object-cover rounded border" onError={() => setB(true)} /> } // eslint-disable-line @next/next/no-img-element

const TEMPLATE = "cleaning_type_code,step_number,procedure_text\nRCT-001,1,Verify equipment surface is free of residue."
function downloadTemplate() { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" })); a.download = "equ_inspection2_sop_steps_template.csv"; a.click() }
function parseCsv(text: string): ImportRow[] { const lines = text.trim().split(/\r?\n/); const h = lines[0].split(",").map((x) => x.trim().toLowerCase().replace(/\s+/g, "_")); return lines.slice(1).map((l) => { const c: Record<string, string> = {}; l.split(",").forEach((v, i) => { c[h[i] ?? `c${i}`] = v.trim().replace(/^"|"$/g, "") }); return { cleaningTypeCode: c["cleaning_type_code"] ?? "", stepNumber: parseInt(c["step_number"] ?? "0", 10) || 0, procedureText: c["procedure_text"] ?? "" } }).filter((r) => r.cleaningTypeCode && r.stepNumber > 0 && r.procedureText) }

function DeleteConfirm({ item, onConfirm, onCancel, isDeleting }: { item: EquInsp2SopStepItem; onConfirm: () => void; onCancel: () => void; isDeleting: boolean }) { return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3"><p className="text-sm font-medium text-destructive">Delete Step {item.stepNumber} of {item.cleaningTypeName}?</p><p className="text-xs text-muted-foreground">S.No will be renumbered automatically.</p><div className="flex gap-2"><Button size="sm" variant="destructive" onClick={onConfirm} disabled={isDeleting}>{isDeleting && <Loader2 className="mr-1.5 size-3 animate-spin" />} Delete</Button><Button size="sm" variant="outline" onClick={onCancel} disabled={isDeleting}>Cancel</Button></div></div> }
function ImportBanner({ result, onClose }: { result: { created: number; skipped: number; errors: { row: number; message: string }[] }; onClose: () => void }) { return <div className="rounded-xl border bg-card p-4 space-y-2"><div className="flex items-center justify-between"><p className="text-sm font-medium">Import complete</p><button onClick={onClose}><X className="size-4 text-muted-foreground" /></button></div><div className="flex gap-4 text-sm"><span className="text-orange-600">âœ“ {result.created} created</span><span className="text-amber-600">âŠ˜ {result.skipped} skipped</span>{result.errors.length > 0 && <span className="text-destructive">âœ— {result.errors.length} errors</span>}</div>{result.errors.length > 0 && <ul className="text-xs text-destructive space-y-0.5 max-h-24 overflow-auto">{result.errors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}</ul>}</div> }

export default function EquInspection2SopPage() {
  const { user, getAccessToken } = useAuth(); const router = useRouter()
  const [steps,        setSteps]        = useState<EquInsp2SopStepItem[]>([])
  const [cleaningTypes,setCleaningTypes] = useState<RoomCleaningTypeItem[]>([])
  const [isLoading,    setIsLoading]    = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [activeTypeId, setActiveTypeId] = useState<string>("")
  const [addOpen,      setAddOpen]      = useState(false)
  const [editStep,     setEditStep]     = useState<EquInsp2SopStepItem | null>(null)
  const [pictureStep,  setPictureStep]  = useState<EquInsp2SopStepItem | null>(null)
  const [deleteId,     setDeleteId]     = useState<string | null>(null)
  const [isDeleting,   setIsDeleting]   = useState(false)
  const [actionError,  setActionError]  = useState<string | null>(null)
  const [isExporting,  setIsExporting]  = useState(false)
  const [isImporting,  setIsImporting]  = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: { row: number; message: string }[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (user && user.role !== "System Administrator" && user.role !== "User Admin") router.replace("/admin") }, [user, router])
  const loadTypes = useCallback(async () => { const t = getAccessToken(); if (!t) return; try { setCleaningTypes(await apiListRoomCleaningTypes(t)) } catch { /* */ } }, [getAccessToken])
  const load = useCallback(async (typeId?: string) => { const t = getAccessToken(); if (!t) return; setIsLoading(true); setError(null); try { setSteps(await apiListEquInsp2SopSteps(t, typeId || undefined)) } catch (err) { setError(err instanceof ApiError ? err.message : "Failed to load") } finally { setIsLoading(false) } }, [getAccessToken])
  useEffect(() => { loadTypes(); load() }, [loadTypes, load])

  function handleTypeFilter(id: string) { setActiveTypeId(id); load(id || undefined) }
  async function handleDelete(id: string) { const t = getAccessToken(); if (!t) return; setIsDeleting(true); setActionError(null); try { await apiDeleteEquInsp2SopStep(t, id); await load(activeTypeId || undefined); setDeleteId(null) } catch (err) { setActionError(err instanceof ApiError ? err.message : "Delete failed") } finally { setIsDeleting(false) } }
  async function handleExport() { const t = getAccessToken(); if (!t) return; setIsExporting(true); try { const blob = await apiExportEquInsp2SopSteps(t, activeTypeId || undefined); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "equ_inspection2_sop_steps.csv"; a.click() } catch { /* */ } finally { setIsExporting(false) } }
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; e.target.value = ""; const t = getAccessToken(); if (!t) return; const rows = parseCsv(await file.text()); if (!rows.length) { setActionError("No valid rows found."); return } setIsImporting(true); try { const result = await apiImportEquInsp2SopSteps(t, rows); setImportResult(result); if (result.created > 0) load(activeTypeId || undefined) } catch (err) { setActionError(err instanceof ApiError ? err.message : "Import failed") } finally { setIsImporting(false) } }

  if (!user) return null
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/configuration/equ-sop" className="flex items-center justify-center size-8 rounded-lg border hover:bg-accent transition-colors"><ChevronLeft className="size-4" /></Link>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-500/10"><ClipboardCheck className="size-5 text-orange-600" /></div>
        <div><h1 className="text-2xl font-semibold tracking-tight">Equ Inspection 2 SOP</h1><p className="text-sm text-muted-foreground">Manage 2nd inspection steps after equipment cleaning</p></div>
      </div>
      {importResult && <ImportBanner result={importResult} onClose={() => setImportResult(null)} />}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => handleTypeFilter("")} className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", activeTypeId === "" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>All Types</button>
          {cleaningTypes.map((ct) => <button key={ct.id} onClick={() => handleTypeFilter(ct.id)} className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", activeTypeId === ct.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>{ct.cleaningTypeName}</button>)}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="mr-1.5 size-3.5" /> Template</Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>{isImporting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Upload className="mr-1.5 size-3.5" />} Import</Button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>{isExporting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 size-3.5" />} Export</Button>
          <Button onClick={() => setAddOpen(true)} disabled={cleaningTypes.length === 0}><Plus className="mr-1.5 size-4" /> Add Step</Button>
        </div>
      </div>
      {actionError && <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><AlertCircle className="size-4 shrink-0" /> {actionError}<button className="ml-auto" onClick={() => setActionError(null)}><X className="size-4" /></button></div>}
      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? <div className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        : error ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-destructive"><AlertCircle className="size-4" /> {error}</div>
        : steps.length === 0 ? <div className="flex flex-col items-center justify-center py-16 gap-2"><ClipboardCheck className="size-8 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">{activeTypeId ? "No steps for this type." : "No steps added yet."}</p></div>
        : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/30">
            <th className="text-right px-4 py-3 font-medium text-muted-foreground w-12">S.No</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Cleaning Type</th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground w-16">Step</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Procedure</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Pictures</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3" />
          </tr></thead><tbody className="divide-y">{steps.map((step) => (
            <tr key={step.id} className="hover:bg-muted/20 transition-colors align-top">
              <td className="px-4 py-3 text-right text-muted-foreground font-mono text-xs">{step.slid}</td>
              <td className="px-4 py-3 text-xs font-medium whitespace-nowrap">{step.cleaningTypeName}</td>
              <td className="px-4 py-3 text-right font-medium">{step.stepNumber}</td>
              <td className="px-4 py-3 max-w-md"><p className="line-clamp-2 text-xs">{step.procedureText}</p></td>
              <td className="px-4 py-3"><button onClick={() => setPictureStep(step)} className="flex items-center gap-1.5 group" title="Manage pictures">{step.media.length > 0 ? <><Thumb url={step.media[0].fileUrl} />{step.media.length > 1 && <span className="text-xs text-muted-foreground">+{step.media.length - 1}</span>}</> : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60 group-hover:text-orange-600 transition-colors"><Camera className="size-4" /> Add</span>}</button></td>
              <td className="px-4 py-3"><StatusBadge status={step.status} /></td>
              <td className="px-4 py-3">{deleteId === step.id ? <DeleteConfirm item={step} onConfirm={() => handleDelete(step.id)} onCancel={() => setDeleteId(null)} isDeleting={isDeleting} /> : <div className="flex items-center justify-end gap-1"><Button variant="ghost" size="icon" className="size-7" onClick={() => setEditStep(step)}><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon" className="size-7 hover:text-destructive" onClick={() => { setDeleteId(step.id); setActionError(null) }}><Trash2 className="size-3.5" /></Button></div>}</td>
            </tr>
          ))}</tbody></table></div>}
      </div>
      <ManagePicturesDialog step={pictureStep} onClose={() => setPictureStep(null)} onMediaChange={(id, media: EquInsp2MediaItem[]) => { setSteps((p) => p.map((s) => s.id === id ? { ...s, media } : s)); if (pictureStep?.id === id) setPictureStep((p) => p ? { ...p, media } : null) }} />
      <AddEquInsp2SopStepDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={(item) => setSteps((p) => [...p, item].sort((a, b) => a.cleaningTypeId.localeCompare(b.cleaningTypeId) || a.stepNumber - b.stepNumber))} cleaningTypes={cleaningTypes} defaultTypeId={activeTypeId || undefined} />
      <EditEquInsp2SopStepDialog item={editStep} onClose={() => setEditStep(null)} onUpdated={(u) => { setSteps((p) => p.map((s) => s.id === u.id ? u : s)); setEditStep(null) }} onMediaChange={(id, media) => setSteps((p) => p.map((s) => s.id === id ? { ...s, media } : s))} />
    </div>
  )
}

