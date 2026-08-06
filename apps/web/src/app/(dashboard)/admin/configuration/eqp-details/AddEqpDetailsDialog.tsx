"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Cpu } from "lucide-react"

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
  apiCreateEquipmentDetail,
  apiListProcessTypes,
  type EquipmentDetailItem,
  EQUIPMENT_TYPES,
  ApiError,
} from "@/lib/auth/api"
import { useEffect } from "react"

const schema = z.object({
  equipmentName:      z.string().min(1, "Name is required").max(150),
  serialNo:           z.string().max(100).optional(),
  supportedProcesses: z.array(z.string()).optional(),
  equipmentType:      z.enum(EQUIPMENT_TYPES),
  manufacturer:       z.string().max(150).optional(),
  purchaseDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().or(z.literal("")),
  commissionDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().or(z.literal("")),
  decommissionDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().or(z.literal("")),
})

type FormValues = z.output<typeof schema>

interface ProcessOption { id: string; label: string }

interface Props {
  open:      boolean
  onClose:   () => void
  onCreated: (item: EquipmentDetailItem) => void
}

export function AddEqpDetailsDialog({ open, onClose, onCreated }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [processes,   setProcesses]   = useState<ProcessOption[]>([])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      equipmentName: "", serialNo: "", supportedProcesses: [],
      equipmentType: "fixed", manufacturer: "",
      purchaseDate: "", commissionDate: "", decommissionDate: "",
    },
  })

  // Load process types for the multi-select
  useEffect(() => {
    if (!open) return
    const token = getAccessToken()
    if (!token) return
    apiListProcessTypes(token).then((items) => {
      setProcesses(items.map((p) => ({ id: p.id, label: p.processType })))
    }).catch(() => {/* ignore */})
  }, [open, getAccessToken])

  async function onSubmit(values: FormValues) {
    const token = getAccessToken()
    if (!token) return
    setSubmitError(null)
    try {
      const created = await apiCreateEquipmentDetail(token, {
        equipmentName:      values.equipmentName,
        serialNo:           values.serialNo           || undefined,
        supportedProcesses: values.supportedProcesses ?? [],
        equipmentType:      values.equipmentType,
        manufacturer:       values.manufacturer        || undefined,
        purchaseDate:       values.purchaseDate        || null,
        commissionDate:     values.commissionDate      || null,
        decommissionDate:   values.decommissionDate    || null,
      })
      onCreated(created)
      form.reset()
      onClose()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "An unexpected error occurred")
    }
  }

  function handleClose() { form.reset(); setSubmitError(null); onClose() }

  const selectedProcesses = form.watch("supportedProcesses") ?? []

  function toggleProcess(id: string) {
    const cur = form.getValues("supportedProcesses") ?? []
    form.setValue(
      "supportedProcesses",
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="size-5 text-primary" /> Add Equipment
          </DialogTitle>
          <DialogDescription>Equipment ID (EQ-001…) generated automatically.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {submitError && (
              <Alert variant="destructive"><AlertDescription>{submitError}</AlertDescription></Alert>
            )}

            {/* Row 1 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="equipmentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="e.g. Tablet Press" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="serialNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial No.</FormLabel>
                    <FormControl><Input placeholder="e.g. SN-12345" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="equipmentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type <span className="text-destructive">*</span></FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {EQUIPMENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer</FormLabel>
                    <FormControl><Input placeholder="e.g. Bosch" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Supported Processes */}
            <FormItem>
              <FormLabel>Supported Processes</FormLabel>
              <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                {processes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No process types configured.</p>
                ) : processes.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-input accent-primary"
                      checked={selectedProcesses.includes(p.id)}
                      onChange={() => toggleProcess(p.id)}
                    />
                    <span className="text-sm">{p.label}</span>
                  </label>
                ))}
              </div>
            </FormItem>

            {/* Date Row */}
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="purchaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="commissionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commission Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="decommissionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Decommission Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                Add Equipment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
