"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, ClipboardCheck, ImageIcon, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"

import { useAuth } from "@/lib/auth/useAuth"
import {
  apiCreateRoomInspection1SopStep,
  apiUploadInspection1MediaFile,
  apiAddInspection1Media,
  type RoomInspection1SopStepItem,
  type RoomCleaningTypeItem,
  ApiError,
} from "@/lib/auth/api"

const schema = z.object({
  cleaningTypeId: z.string().min(1, "Cleaning type is required"),
  stepNumber:     z.coerce.number().int().min(1, "Step number must be ≥ 1"),
  procedureText:  z.string().min(1, "Procedure is required").max(5000),
})

type FormInput  = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface Props {
  open:          boolean
  onClose:       () => void
  onCreated:     (item: RoomInspection1SopStepItem) => void
  cleaningTypes: RoomCleaningTypeItem[]
  defaultTypeId?: string
}

// ── Pending picture type ─────────────────────────────────────────────────────
interface PendingPic { id: string; file: File; previewUrl: string }

export function AddInspection1SopStepDialog({ open, onClose, onCreated, cleaningTypes, defaultTypeId }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Pending pictures (uploaded after step is created)
  const [pending,     setPending]     = useState<PendingPic[]>([])
  const [picError,    setPicError]    = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Revoke object URLs when dialog closes or on unmount
  useEffect(() => {
    if (!open) {
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl))
      setPending([])
      setPicError(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (fileInputRef.current) fileInputRef.current.value = ""
    const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
    const valid   = files.filter((f) => ALLOWED.includes(f.type))
    if (valid.length < files.length) setPicError("Some files were skipped — only JPEG, PNG, WebP, GIF are allowed")
    else setPicError(null)
    const newPics: PendingPic[] = valid.map((f) => ({
      id: `${Date.now()}-${Math.random()}`, file: f, previewUrl: URL.createObjectURL(f),
    }))
    setPending((prev) => [...prev, ...newPics])
  }

  function removePending(id: string) {
    setPending((prev) => {
      const found = prev.find((p) => p.id === id)
      if (found) URL.revokeObjectURL(found.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cleaningTypeId: defaultTypeId ?? "",
      stepNumber:     1,
      procedureText:  "",
    },
  })

  async function onSubmit(values: FormValues) {
    const token = getAccessToken()
    if (!token) return
    setSubmitError(null)
    try {
      const created = await apiCreateRoomInspection1SopStep(token, {
        cleaningTypeId: values.cleaningTypeId,
        stepNumber:     values.stepNumber,
        procedureText:  values.procedureText,
      })

      // Upload any pending pictures sequentially
      const uploadedMedia = [...(created.media ?? [])]
      for (const pic of pending) {
        try {
          const uploaded = await apiUploadInspection1MediaFile(token, pic.file)
          const media    = await apiAddInspection1Media(token, created.id, {
            fileUrl:  uploaded.url,
            fileName: uploaded.fileName,
            fileType: uploaded.fileType,
          })
          uploadedMedia.push(media)
        } catch {
          // Non-fatal — step was created; pictures can be added via Manage Pictures
        }
      }

      onCreated({ ...created, media: uploadedMedia })
      form.reset({ ...form.getValues(), stepNumber: values.stepNumber + 1, procedureText: "" })
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl))
      setPending([])
      onClose()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "An unexpected error occurred")
    }
  }

  function handleClose() { form.reset(); setSubmitError(null); onClose() }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-primary" /> Add Inspection Step
          </DialogTitle>
          <DialogDescription>Add a new Inspection 1 SOP step.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {submitError && (
              <Alert variant="destructive"><AlertDescription>{submitError}</AlertDescription></Alert>
            )}
            {picError && (
              <Alert variant="destructive"><AlertDescription className="text-xs">{picError}</AlertDescription></Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="cleaningTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cleaning Type <span className="text-destructive">*</span></FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {cleaningTypes.map((ct) => (
                          <SelectItem key={ct.id} value={ct.id}>{ct.cleaningTypeName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="stepNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Step No. <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="number" min={1} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField control={form.control} name="procedureText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Procedure <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what the inspector must check…"
                      className="min-h-28 resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Pictures ── */}
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <ImageIcon className="size-4 text-muted-foreground" /> Pictures
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent transition-colors"
                >
                  <Plus className="size-3" /> Add image
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="sr-only"
                onChange={handleFileAdd}
              />
              {pending.length === 0 ? (
                <p className="text-xs text-muted-foreground">No images added yet — step can be created without pictures</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {pending.map((p) => (
                    <div key={p.id} className="relative size-16 rounded-lg overflow-hidden border bg-muted shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePending(p.id)}
                        className="absolute top-0.5 right-0.5 flex items-center justify-center size-4 rounded-full bg-black/60 text-white hover:bg-destructive transition-colors"
                      >
                        <X className="size-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                Add Step
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
