"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Droplets } from "lucide-react"

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
import { Alert, AlertDescription } from "@/components/ui/alert"

import { useAuth } from "@/lib/auth/useAuth"
import {
  apiCreateRoomCleaningType,
  type RoomCleaningTypeItem,
  ROOM_CLEANING_DEFAULT_METHODS,
  ApiError,
} from "@/lib/auth/api"

const METHOD_LABELS: Record<string, string> = {
  TypeA: "Type A — Dry",
  TypeB: "Type B — Wet",
  TypeC: "Type C — Sanitization",
}

const schema = z.object({
  cleaningTypeName:    z.string().min(1, "Name is required").max(150),
  cleaningTypeDetails: z.string().max(2000).optional(),
  defaultMethod:       z.enum(ROOM_CLEANING_DEFAULT_METHODS).or(z.literal("none")),
  displayOrder:        z.coerce.number().int().min(0),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open:      boolean
  onClose:   () => void
  onCreated: (item: RoomCleaningTypeItem) => void
}

export function AddCleaningTypeDialog({ open, onClose, onCreated }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { cleaningTypeName: "", cleaningTypeDetails: "", defaultMethod: "none", displayOrder: 0 },
  })

  async function onSubmit(values: FormValues) {
    const token = getAccessToken()
    if (!token) return
    setSubmitError(null)
    try {
      const created = await apiCreateRoomCleaningType(token, {
        cleaningTypeName:    values.cleaningTypeName,
        cleaningTypeDetails: values.cleaningTypeDetails || undefined,
        defaultMethod:       values.defaultMethod === "none" ? undefined : values.defaultMethod,
        displayOrder:        values.displayOrder,
      })
      onCreated(created)
      form.reset()
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
            <Droplets className="size-5 text-primary" /> Add Cleaning Type
          </DialogTitle>
          <DialogDescription>Type code (RCT-001…) generated automatically.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {submitError && (
              <Alert variant="destructive"><AlertDescription>{submitError}</AlertDescription></Alert>
            )}

            <FormField control={form.control} name="cleaningTypeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cleaning Type Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="e.g. Area Cleaning" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="cleaningTypeDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Details</FormLabel>
                  <FormControl><Input placeholder="Optional description" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="defaultMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Method</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {ROOM_CLEANING_DEFAULT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Add Cleaning Type
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
