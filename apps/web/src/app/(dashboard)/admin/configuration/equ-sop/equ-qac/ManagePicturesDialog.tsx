"use client"
import { useEffect, useRef, useState } from "react"
import { ImageIcon, Trash2, Loader2, Plus, Upload, Link2, AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth/useAuth"
import { apiAddEquQacMedia, apiDeleteEquQacMedia, apiUploadEquQacMediaFile, type EquQacSopStepItem, type EquQacMediaItem, ApiError } from "@/lib/auth/api"
import { cn } from "@/lib/utils"
function Thumb({ url, alt }: { url: string; alt: string }) { const [b, setB] = useState(false); if (b) return <div className="w-full h-full flex items-center justify-center bg-muted rounded"><ImageIcon className="size-6 text-muted-foreground/40" /></div>; return <img src={url} alt={alt} className="w-full h-full object-cover rounded" onError={() => setB(true)} /> } // eslint-disable-line @next/next/no-img-element
interface Props { step: EquQacSopStepItem | null; onClose: () => void; onMediaChange: (id: string, m: EquQacMediaItem[]) => void }
export function ManagePicturesDialog({ step, onClose, onMediaChange }: Props) {
  const { getAccessToken } = useAuth()
  const [media, setMedia] = useState<EquQacMediaItem[]>(step?.media ?? [])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [addMode, setAddMode] = useState<"file"|"url">("file")
  const [selFile, setSelFile] = useState<File | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState("")
  const [caption, setCaption] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (step) setMedia(step.media) }, [step])
  useEffect(() => { return () => { if (previewSrc?.startsWith("blob:")) URL.revokeObjectURL(previewSrc) } }, [previewSrc])
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (!f) return; if (previewSrc?.startsWith("blob:")) URL.revokeObjectURL(previewSrc); setSelFile(f); setPreviewSrc(URL.createObjectURL(f)); setAddError(null) }
  function clearFile() { if (previewSrc?.startsWith("blob:")) URL.revokeObjectURL(previewSrc); setSelFile(null); setPreviewSrc(null); if (ref.current) ref.current.value = "" }
  function switchMode(m: "file"|"url") { setAddMode(m); setAddError(null); clearFile(); setUrlInput("") }
  async function handleAdd() {
    if (!step) return; const t = getAccessToken(); if (!t) return; setIsAdding(true); setAddError(null)
    try {
      let fileUrl: string, fileName: string | undefined, fileType: string | undefined
      if (addMode === "file") { if (!selFile) { setAddError("Choose a file"); setIsAdding(false); return }; const r = await apiUploadEquQacMediaFile(t, selFile); fileUrl = r.url; fileName = r.fileName; fileType = r.fileType }
      else { const tr = urlInput.trim(); if (!tr) { setAddError("Enter a URL"); setIsAdding(false); return }; if (!tr.startsWith("http://") && !tr.startsWith("https://")) { setAddError("URL must be http/https"); setIsAdding(false); return }; fileUrl = tr }
      const created = await apiAddEquQacMedia(t, step.id, { fileUrl, fileName, fileType, caption: caption.trim() || undefined })
      const upd = [...media, created]; setMedia(upd); onMediaChange(step.id, upd); clearFile(); setUrlInput(""); setCaption("")
    } catch (err) { setAddError(err instanceof ApiError ? err.message : "Failed to add") } finally { setIsAdding(false) }
  }
  async function handleDelete(mediaId: string) {
    if (!step) return; const t = getAccessToken(); if (!t) return; setDeletingId(mediaId); setDeleteError(null)
    try { await apiDeleteEquQacMedia(t, step.id, mediaId); const upd = media.filter((m) => m.id !== mediaId); setMedia(upd); onMediaChange(step.id, upd) } catch (err) { setDeleteError(err instanceof ApiError ? err.message : "Failed to delete") } finally { setDeletingId(null) }
  }
  function handleOpenChange(open: boolean) { if (!open) { clearFile(); setUrlInput(""); setCaption(""); setAddError(null); setDeleteError(null); onClose() } }
  if (!step) return null
  return (
    <Dialog open={!!step} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ImageIcon className="size-5 text-violet-600" /> Pictures</DialogTitle><DialogDescription>{step.cleaningTypeName} â€” Step {step.stepNumber} <span className="ml-2 text-xs text-amber-600">(min. 1 required for approved steps)</span></DialogDescription></DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {deleteError && <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"><AlertCircle className="size-3.5 shrink-0" /> {deleteError}<button className="ml-auto" onClick={() => setDeleteError(null)}><X className="size-3" /></button></div>}
          {media.length === 0 ? <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted py-10 gap-2 text-center"><ImageIcon className="size-8 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">No pictures yet</p></div> : <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{media.map((m) => <div key={m.id} className="relative group rounded-xl border bg-card overflow-hidden"><div className="aspect-[4/3] bg-muted"><Thumb url={m.fileUrl} alt={m.caption ?? `Picture ${m.displayOrder}`} /></div><button onClick={() => handleDelete(m.id)} disabled={!!deletingId} className={cn("absolute top-1.5 right-1.5 flex items-center justify-center size-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive disabled:cursor-not-allowed")} title="Delete">{deletingId === m.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}</button>{m.caption ? <div className="px-2 py-1.5 text-xs text-muted-foreground line-clamp-2">{m.caption}</div> : <div className="px-2 py-1 text-xs text-muted-foreground/40">#{m.displayOrder}</div>}</div>)}</div>}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium flex items-center gap-1.5"><Plus className="size-4" /> Add Picture</p>
            <div className="flex gap-1 rounded-lg border bg-background p-0.5 w-fit">{(["file","url"] as const).map((mode) => <button key={mode} type="button" onClick={() => switchMode(mode)} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors", addMode === mode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{mode === "file" ? <><Upload className="size-3.5" /> Upload file</> : <><Link2 className="size-3.5" /> Enter URL</>}</button>)}</div>
            {addError && <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"><AlertCircle className="size-3.5 shrink-0" /> {addError}<button className="ml-auto" onClick={() => setAddError(null)}><X className="size-3" /></button></div>}
            {addMode === "file" && <div className="space-y-2"><input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={handleFileChange} />{previewSrc ? <div className="relative w-full max-w-xs">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={previewSrc} alt="Preview" className="w-full max-h-44 object-contain rounded-lg border bg-muted" /><button type="button" onClick={clearFile} className="absolute top-1 right-1 flex items-center justify-center size-5 rounded-full bg-black/60 text-white hover:bg-destructive transition-colors"><X className="size-3" /></button><p className="mt-1 text-xs text-muted-foreground truncate">{selFile?.name}</p></div> : <button type="button" onClick={() => ref.current?.click()} className={cn("w-full rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-1.5 py-7 text-sm text-muted-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer")}><Upload className="size-6 opacity-50" /><span>Click to choose image</span><span className="text-xs opacity-60">JPEG Â· PNG Â· WebP Â· GIF Â· max 10 MB</span></button>}</div>}
            {addMode === "url" && <div className="space-y-2"><Label className="text-xs">Image URL <span className="text-destructive">*</span></Label><Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://example.com/image.jpg" className="text-xs" />{urlInput.startsWith("http") && <img src={urlInput} alt="preview" className="w-full max-w-xs max-h-32 object-contain rounded-lg border bg-muted" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} onLoad={(e) => { (e.target as HTMLImageElement).style.display = "block" }} />}</div>} {/* eslint-disable-line @next/next/no-img-element */}
            <div className="space-y-1.5"><Label className="text-xs">Caption (optional)</Label><Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. Equipment should look clean and dry" className="text-xs" maxLength={500} /></div>
            <Button type="button" size="sm" disabled={isAdding || (addMode === "file" ? !selFile : !urlInput.trim())} onClick={handleAdd}>{isAdding ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Plus className="mr-1.5 size-3.5" />} Add Picture</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

