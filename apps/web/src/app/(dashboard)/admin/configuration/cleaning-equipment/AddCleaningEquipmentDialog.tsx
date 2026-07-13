"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Sparkles } from "lucide-react"

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
  apiCreateCleaningEquipment,
  type CleaningEquipmentItem,
  CLEANING_TYPES,
  ApiError,
} from "@/lib/auth/api"

const schema = z.object({
  equipmentName:            z.string().min(1, "Name is required").max(150),
  equipmentDetails:         z.string().max(2000).optional(),
  cleaningType:             z.enum(CLEANING_TYPES),
  material:                 z.string().max(100).optional(),
  requiresReplacement:      z.boolean(),
  replacementIntervalDays:  z.coerce.number().int().min(1).optional().or(z.literal("")),
  displayOrder:             z.coerce.number().int().min(0),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open:      boolean
  onClose:   () => void
  onCreated: (item: CleaningEquipmentItem) => void
}

export function AddCleaningEquipmentDialog({ open, onClose, onCreated }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      equipmentName: "", equipmentDetails: "", cleaningType: "general",
      material: "", requiresReplacement: false,
      replacementIntervalDays: "", displayOrder: 0,
    },
  })

  const requiresReplacement = form.watch("requiresReplacement")

  async function onSubmit(values: FormValues) {
    const token = getAccessToken()
    if (!token) return
    setSubmitError(null)
    try {
      const created = await apiCreateCleaningEquipment(token, {
        equipmentName:            values.equipmentName,
        equipmentDetails:         values.equipmentDetails   || undefined,
        cleaningType:             values.cleaningType,
        material:                 values.material           || undefined,
        requiresReplacement:      values.requiresReplacement,
        replacementIntervalDays:  values.requiresReplacement && values.replacementIntervalDays !== ""
          ? Number(values.replacementIntervalDays) : null,
        displayOrder:             values.displayOrder,
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
            <Sparkles className="size-5 text-primary" /> Add Cleaning Equipment
          </DialogTitle>
          <DialogDescription>Equipment code (CE-001…) generated automatically.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {submitError && (
              <Alert variant="destructive"><AlertDescription>{submitError}</AlertDescription></Alert>
            )}

            <FormField control={form.control} name="equipmentName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipment Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="e.g. Mop" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="equipmentDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Details</FormLabel>
                  <FormControl><Input placeholder="Optional description" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="cleaningType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cleaning Type <span className="text-destructive">*</span></FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {CLEANING_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="material"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material</FormLabel>
                    <FormControl><Input placeholder="e.g. Stainless Steel" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 items-end">
              <FormField control={form.control} name="requiresReplacement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requires Replacement</FormLabel>
                    <FormControl>
                      <label className="flex items-center gap-2 cursor-pointer mt-2">
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="size-4 rounded border-input accent-primary"
                        />
                        <span className="text-sm text-muted-foreground">Yes</span>
                      </label>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {requiresReplacement && (
                <FormField control={form.control} name="replacementIntervalDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Replace Every (days)</FormLabel>
                      <FormControl><Input type="number" min={1} placeholder="30" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField control={form.control} name="displayOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Order</FormLabel>
                  <FormControl><Input type="number" min={0} placeholder="0" className="w-32" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                Add Equipment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
