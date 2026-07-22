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
  apiUpdateRoomCleaningType,
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
  isActive:            z.enum(["true", "false"]),
})

type FormValues = z.output<typeof schema>

interface Props {
  item:      RoomCleaningTypeItem | null
  onClose:   () => void
  onUpdated: (item: RoomCleaningTypeItem) => void
}

export function EditCleaningTypeDialog({ item, onClose, onUpdated }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      cleaningTypeName: "", cleaningTypeDetails: "",
      defaultMethod: "none", displayOrder: 0, isActive: "true",
    },
  })

  useEffect(() => {
    if (item) {
      form.reset({
        cleaningTypeName:    item.cleaningTypeName,
        cleaningTypeDetails: item.cleaningTypeDetails ?? "",
        defaultMethod:       item.defaultMethod ?? "none",
        displayOrder:        item.displayOrder,
        isActive:            item.isActive ? "true" : "false",
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
      const updated = await apiUpdateRoomCleaningType(token, item.id, {
        cleaningTypeName:    values.cleaningTypeName,
        cleaningTypeDetails: values.cleaningTypeDetails || null,
        defaultMethod:       values.defaultMethod === "none" ? null : values.defaultMethod,
        displayOrder:        values.displayOrder,
        isActive:            values.isActive === "true",
      })
      onUpdated(updated)
      onClose()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "An unexpected error occurred")
    }
  }

  function handleClose() { setSubmitError(null); onClose() }

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-5 text-primary" /> Edit Cleaning Type
          </DialogTitle>
          <DialogDescription>
            Code: <span className="font-mono">{item?.cleaningTypeCode}</span>
          </DialogDescription>
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
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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

            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
