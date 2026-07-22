"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Wrench, ImageIcon, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/lib/auth/useAuth"
import {
  apiCreateEquCleaningSopStep, apiUploadEquSopMediaFile, apiAddEquSopMedia,
  EQU_CLEANING_METHODS, type EquCleaningSopStepItem, type RoomCleaningTypeItem, ApiError,
} from "@/lib/auth/api"

const METHOD_LABELS: Record<string, string> = {
  TypeA: "Type A — Dry", TypeB: "Type B — Wet", TypeC: "Type C — Sanitization",
}

const schema = z.object({
  cleaningTypeId:      z.string().min(1, "Cleaning type is required"),
  stepNumber:          z.coerce.number().int().min(1, "Step number must be ≥ 1"),
  timeAllottedDisplay: z.string().max(10).optional(),
  cleaningMethod:      z.enum(EQU_CLEANING_METHODS),
  procedureText:       z.string().min(1, "Procedure is required").max(5000),
  chemicalUsed:        z.string().max(200).optional(),
  equipmentUsed:       z.string().max(300).optional(),
})
type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean; onClose: () => void
  onCreated: (item: EquCleaningSopStepItem) => void
  cleaningTypes: RoomCleaningTypeItem[]; defaultTypeId?: string
}
interface PendingPic { id: string; file: File; previewUrl: string }

export function AddEquCleaningSopStepDialog({ open, onClose, onCreated, cleaningTypes, defaultTypeId }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pending,     setPending]     = useState<PendingPic[]>([])
  const [picError,    setPicError]    = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) { pending.forEach((p) => URL.revokeObjectURL(p.previewUrl)); setPending([]); setPicError(null) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []); if (fileInputRef.current) fileInputRef.current.value = ""
    const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
    const existing = pending.length
    const remaining = 3 - existing
    const valid = files.filter((f) => ALLOWED.includes(f.type)).slice(0, remaining)
    if (valid.length < files.length || remaining < files.length) setPicError(`Only up to 3 pictures allowed. ${existing} already added.`)
    else setPicError(null)
    setPending((prev) => [...prev, ...valid.map((f) => ({ id: `${Date.now()}-${Math.random()}`, file: f, previewUrl: URL.createObjectURL(f) }))])
  }

  function removePending(id: string) {
    setPending((prev) => { const found = prev.find((p) => p.id === id); if (found) URL.revokeObjectURL(found.previewUrl); return prev.filter((p) => p.id !== id) })
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { cleaningTypeId: defaultTypeId ?? "", stepNumber: 1, timeAllottedDisplay: "", cleaningMethod: "TypeB", procedureText: "", chemicalUsed: "", equipmentUsed: "" },
  })

  async function onSubmit(values: FormValues) {
    const token = getAccessToken(); if (!token) return; setSubmitError(null)
    try {
      const created = await apiCreateEquCleaningSopStep(token, {
        cleaningTypeId: values.cleaningTypeId, stepNumber: values.stepNumber,
        timeAllottedDisplay: values.timeAllottedDisplay || undefined,
        cleaningMethod: values.cleaningMethod, procedureText: values.procedureText,
        chemicalUsed: values.chemicalUsed || undefined,
        equipmentUsed: values.equipmentUsed || undefined,
      })
      const uploadedMedia = [...(created.media ?? [])]
      for (const pic of pending) {
        try {
          const uploaded = await apiUploadEquSopMediaFile(token, pic.file)
          const media    = await apiAddEquSopMedia(token, created.id, { fileUrl: uploaded.url, fileName: uploaded.fileName, fileType: uploaded.fileType })
          uploadedMedia.push(media)
        } catch { /* non-fatal */ }
      }
      onCreated({ ...created, media: uploadedMedia })
      form.reset({ ...form.getValues(), stepNumber: values.stepNumber + 1, procedureText: "", chemicalUsed: "", equipmentUsed: "" })
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl)); setPending([]); onClose()
    } catch (err) { setSubmitError(err instanceof ApiError ? err.message : "An unexpected error occurred") }
  }

  function handleClose() { form.reset(); setSubmitError(null); onClose() }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wrench className="size-5 text-primary" /> Add Equipment Cleaning Step</DialogTitle>
          <DialogDescription>Add a new equipment cleaning SOP step.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {submitError && <Alert variant="destructive"><AlertDescription>{submitError}</AlertDescription></Alert>}
            {picError    && <Alert variant="destructive"><AlertDescription className="text-xs">{picError}</AlertDescription></Alert>}

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="cleaningTypeId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cleaning Type <span className="text-destructive">*</span></FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                    <SelectContent>{cleaningTypes.map((ct) => <SelectItem key={ct.id} value={ct.id}>{ct.cleaningTypeName}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="stepNumber" render={({ field }) => (
                <FormItem><FormLabel>Step No. <span className="text-destructive">*</span></FormLabel><FormControl><Input type="number" min={1} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="cleaningMethod" render={({ field }) => (
                <FormItem>
                  <FormLabel>Dry/Wet/San <span className="text-destructive">*</span></FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{EQU_CLEANING_METHODS.map((m) => <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="timeAllottedDisplay" render={({ field }) => (
                <FormItem><FormLabel>Time Allotted</FormLabel><FormControl><Input placeholder="e.g. 00:10" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <FormField control={form.control} name="procedureText" render={({ field }) => (
              <FormItem>
                <FormLabel>Procedure <span className="text-destructive">*</span></FormLabel>
                <FormControl><Textarea placeholder="Describe the exact steps the operator must follow…" className="min-h-24 resize-none" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="chemicalUsed" render={({ field }) => (
                <FormItem><FormLabel>Chemical Used</FormLabel><FormControl><Input placeholder="e.g. Detergent Solution, NA" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="equipmentUsed" render={({ field }) => (
                <FormItem><FormLabel>Equipment Used</FormLabel><FormControl><Input placeholder="e.g. Lint-free wipe, Brush" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            {/* Pictures (up to 3) */}
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <ImageIcon className="size-4 text-muted-foreground" /> View Links
                  <span className="text-xs font-normal text-muted-foreground">(up to 3 pictures)</span>
                </span>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={pending.length >= 3} className="flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent transition-colors disabled:opacity-40">
                  <Plus className="size-3" /> Add image
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={handleFileAdd} />
              {pending.length === 0 ? (
                <p className="text-xs text-muted-foreground">No images added yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {pending.map((p) => (
                    <div key={p.id} className="relative size-16 rounded-lg overflow-hidden border bg-muted shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removePending(p.id)} className="absolute top-0.5 right-0.5 flex items-center justify-center size-4 rounded-full bg-black/60 text-white hover:bg-destructive transition-colors"><X className="size-2.5" /></button>
                    </div>
                  ))}
                  <p className="w-full text-xs text-muted-foreground">{pending.length}/3 pictures</p>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <DialogClose asChild><Button type="button" variant="outline" onClick={handleClose}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-1.5 size-4 animate-spin" />} Add Step
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
