"use client"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Pencil, ImageIcon, Plus, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/lib/auth/useAuth"
import { apiUpdateEquInsp2SopStep, apiUploadEquInsp2MediaFile, apiAddEquInsp2Media, apiDeleteEquInsp2Media, EQU_INSP2_STATUSES, type EquInsp2SopStepItem, type EquInsp2MediaItem, ApiError } from "@/lib/auth/api"
const SL: Record<string, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected", archived: "Archived" }
const schema = z.object({ stepNumber: z.coerce.number().int().min(1), procedureText: z.string().min(1).max(5000), status: z.enum(EQU_INSP2_STATUSES) })
type FV = z.infer<typeof schema>
interface Props { item: EquInsp2SopStepItem | null; onClose: () => void; onUpdated: (i: EquInsp2SopStepItem) => void; onMediaChange?: (id: string, m: EquInsp2MediaItem[]) => void }
export function EditEquInsp2SopStepDialog({ item, onClose, onUpdated, onMediaChange }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [localMedia, setLocalMedia]   = useState<EquInsp2MediaItem[]>([])
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [picError, setPicError]       = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)
  const form = useForm<FV>({ resolver: zodResolver(schema), defaultValues: { stepNumber: 1, procedureText: "", status: "approved" } })
  useEffect(() => { if (item) { setLocalMedia(item.media ?? []); setPicError(null); form.reset({ stepNumber: item.stepNumber, procedureText: item.procedureText, status: item.status as typeof EQU_INSP2_STATUSES[number] }); setSubmitError(null) } }, [item]) // eslint-disable-line react-hooks/exhaustive-deps
  async function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    if (!item) return; const file = e.target.files?.[0]; if (ref.current) ref.current.value = ""; if (!file) return
    if (!["image/jpeg","image/jpg","image/png","image/webp","image/gif"].includes(file.type)) { setPicError("Only JPEG/PNG/WebP/GIF"); return }
    const t = getAccessToken(); if (!t) return; setIsUploading(true); setPicError(null)
    try { const u = await apiUploadEquInsp2MediaFile(t, file); const m = await apiAddEquInsp2Media(t, item.id, { fileUrl: u.url, fileName: u.fileName, fileType: u.fileType }); const upd = [...localMedia, m]; setLocalMedia(upd); onMediaChange?.(item.id, upd) } catch (err) { setPicError(err instanceof ApiError ? err.message : "Upload failed") } finally { setIsUploading(false) }
  }
  async function handleDeleteMedia(mediaId: string) {
    if (!item) return; const t = getAccessToken(); if (!t) return; setDeletingId(mediaId); setPicError(null)
    try { await apiDeleteEquInsp2Media(t, item.id, mediaId); const upd = localMedia.filter((m) => m.id !== mediaId); setLocalMedia(upd); onMediaChange?.(item.id, upd) } catch (err) { setPicError(err instanceof ApiError ? err.message : "Delete failed") } finally { setDeletingId(null) }
  }
  async function onSubmit(v: FV) {
    if (!item) return; const t = getAccessToken(); if (!t) return; setSubmitError(null)
    try { const u = await apiUpdateEquInsp2SopStep(t, item.id, { stepNumber: v.stepNumber, procedureText: v.procedureText, status: v.status }); onUpdated({ ...u, media: localMedia }); onClose() } catch (err) { setSubmitError(err instanceof ApiError ? err.message : "Unexpected error") }
  }
  function handleClose() { setSubmitError(null); onClose() }
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="size-5 text-primary" /> Edit Inspection 2 Step</DialogTitle><DialogDescription>{item?.cleaningTypeName} â€” Step {item?.stepNumber}</DialogDescription></DialogHeader>
        <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {submitError && <Alert variant="destructive"><AlertDescription>{submitError}</AlertDescription></Alert>}
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="stepNumber" render={({ field }) => (<FormItem><FormLabel>Step No. <span className="text-destructive">*</span></FormLabel><FormControl><Input type="number" min={1} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{EQU_INSP2_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{SL[s]}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
          </div>
          <FormField control={form.control} name="procedureText" render={({ field }) => (<FormItem><FormLabel>Procedure <span className="text-destructive">*</span></FormLabel><FormControl><Textarea placeholder="Describe what the inspector must checkâ€¦" className="min-h-24 resize-none" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between"><span className="text-sm font-medium flex items-center gap-1.5"><ImageIcon className="size-4 text-muted-foreground" /> Pictures</span><button type="button" onClick={() => ref.current?.click()} disabled={isUploading} className="flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent transition-colors disabled:opacity-50">{isUploading ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}{isUploading ? "Uploadingâ€¦" : "Add image"}</button></div>
            <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={handleFileAdd} />
            {picError && <p className="text-xs text-destructive">{picError}</p>}
            {localMedia.length === 0 ? <p className="text-xs text-muted-foreground">No pictures yet</p> : <div className="flex flex-wrap gap-2">{localMedia.map((m) => <div key={m.id} className="relative size-16 rounded-lg overflow-hidden border bg-muted shrink-0 group">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={m.fileUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} /><button type="button" onClick={() => handleDeleteMedia(m.id)} disabled={!!deletingId} className="absolute top-0.5 right-0.5 flex items-center justify-center size-4 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-destructive transition-all disabled:cursor-not-allowed">{deletingId === m.id ? <Loader2 className="size-2.5 animate-spin" /> : <Trash2 className="size-2.5" />}</button></div>)}</div>}
          </div>
          <DialogFooter><DialogClose asChild><Button type="button" variant="outline" onClick={handleClose}>Cancel</Button></DialogClose><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting && <Loader2 className="mr-1.5 size-4 animate-spin" />} Save Changes</Button></DialogFooter>
        </form></Form>
      </DialogContent>
    </Dialog>
  )
}

