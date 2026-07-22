"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Pencil } from "lucide-react"

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
  apiUpdateCleaningEquipment,
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
  isActive:                 z.enum(["true", "false"]),
})

type FormValues = z.output<typeof schema>

interface Props {
  item:      CleaningEquipmentItem | null
  onClose:   () => void
  onUpdated: (item: CleaningEquipmentItem) => void
}

export function EditCleaningEquipmentDialog({ item, onClose, onUpdated }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      equipmentName: "", equipmentDetails: "", cleaningType: "general",
      material: "", requiresReplacement: false,
      replacementIntervalDays: "", displayOrder: 0, isActive: "true",
    },
  })

  const requiresReplacement = form.watch("requiresReplacement")

  useEffect(() => {
    if (item) {
      form.reset({
        equipmentName:           item.equipmentName,
        equipmentDetails:        item.equipmentDetails        ?? "",
        cleaningType:            item.cleaningType            as typeof CLEANING_TYPES[number],
        material:                item.material                ?? "",
        requiresReplacement:     item.requiresReplacement,
        replacementIntervalDays: item.replacementIntervalDays ?? "",
        displayOrder:            item.displayOrder,
        isActive:                item.isActive ? "true" : "false",
      })
      setSubmitError(null)
    }
  }, [item, form])

  async function onSubmit(values: FormValues) {
    if (!item) return
    const token = getAccessToken()
    if (!token) return
    setSubmitError(null)
    try {
      const updated = await apiUpdateCleaningEquipment(token, item.id, {
        equipmentName:           values.equipmentName,
        equipmentDetails:        values.equipmentDetails  || null,
        cleaningType:            values.cleaningType,
        material:                values.material          || null,
        requiresReplacement:     values.requiresReplacement,
        replacementIntervalDays: values.requiresReplacement && values.replacementIntervalDays !== ""
          ? Number(values.replacementIntervalDays) : null,
        displayOrder:            values.displayOrder,
        isActive:                values.isActive === "true",
      })
      onUpdated(updated)
      onClose()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "An unexpected error occurred")
    }
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-5 text-primary" /> Edit Cleaning Equipment
          </DialogTitle>
          <DialogDescription>
            Code: <span className="font-mono font-medium">{item?.equipmentCode}</span>
          </DialogDescription>
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
                  <FormControl><Input {...field} /></FormControl>
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
                    <FormLabel>Cleaning Type</FormLabel>
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
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4 items-end">
              <FormField control={form.control} name="requiresReplacement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Needs Replacement</FormLabel>
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

              <FormField control={form.control} name="replacementIntervalDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Replace Every (days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number" min={1} placeholder="30"
                        disabled={!requiresReplacement}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField control={form.control} name="displayOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Order</FormLabel>
                  <FormControl><Input type="number" min={0} className="w-32" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
