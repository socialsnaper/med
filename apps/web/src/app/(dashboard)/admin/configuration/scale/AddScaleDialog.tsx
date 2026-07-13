"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"

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
  apiCreateScale, type ScaleItem, SCALE_TYPES, ApiError,
} from "@/lib/auth/api"

const schema = z.object({
  scaleNumber:              z.string().min(1, "Scale number is required").max(50),
  scaleType:                z.enum(["analytical", "precision", "industrial", "moisture", "other"]).optional(),
  minRange:                 z.string().max(20).optional(),
  maxRange:                 z.string().max(20).optional(),
  capacity:                 z.string().max(20).optional(),
  leastCount:               z.string().max(20).optional(),
  manufacturer:             z.string().max(100).optional(),
  modelNumber:              z.string().max(100).optional(),
  lastVerifiedOn:           z.string().optional(),
  nextVerificationDue:      z.string().optional(),
  verificationIntervalDays: z.coerce.number().int().min(1).optional(),
  formVerificationNo:       z.string().max(20).optional(),
  nextCalibrationDue:       z.string().optional(),
  calibrationIntervalDays:  z.coerce.number().int().min(1).optional(),
  formCalibrationNo:        z.string().max(20).optional(),
})

type FormValues = z.infer<typeof schema>

const TYPE_LABELS: Record<string, string> = {
  analytical: "Analytical",
  precision:  "Precision",
  industrial: "Industrial",
  moisture:   "Moisture",
  other:      "Other",
}

interface Props {
  open:      boolean
  onClose:   () => void
  onCreated: (item: ScaleItem) => void
}

export function AddScaleDialog({ open, onClose, onCreated }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      scaleNumber: "", scaleType: undefined,
      minRange: "", maxRange: "", capacity: "", leastCount: "",
      manufacturer: "", modelNumber: "",
      lastVerifiedOn: "", nextVerificationDue: "",
      verificationIntervalDays: 1, formVerificationNo: "",
      nextCalibrationDue: "", calibrationIntervalDays: 365, formCalibrationNo: "",
    },
  })

  async function onSubmit(values: FormValues) {
    const token = getAccessToken()
    if (!token) return
    setSubmitError(null)
    try {
      const created = await apiCreateScale(token, {
        scaleNumber:              values.scaleNumber,
        scaleType:                values.scaleType             || null,
        minRange:                 values.minRange              || null,
        maxRange:                 values.maxRange              || null,
        capacity:                 values.capacity              || null,
        leastCount:               values.leastCount            || null,
        manufacturer:             values.manufacturer          || null,
        modelNumber:              values.modelNumber           || null,
        lastVerifiedOn:           values.lastVerifiedOn        || null,
        nextVerificationDue:      values.nextVerificationDue   || null,
        verificationIntervalDays: values.verificationIntervalDays ?? 1,
        formVerificationNo:       values.formVerificationNo    || null,
        nextCalibrationDue:       values.nextCalibrationDue    || null,
        calibrationIntervalDays:  values.calibrationIntervalDays ?? 365,
        formCalibrationNo:        values.formCalibrationNo     || null,
      })
      onCreated(created)
      form.reset()
      onClose()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to add scale")
    }
  }

  function handleClose() {
    form.reset()
    setSubmitError(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Scale</DialogTitle>
          <DialogDescription>Register a new weighing scale in the facility.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="scaleNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Scale No. (Manufacturer S/N) <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="SN-1001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="scaleType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Scale Type</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || undefined)}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {SCALE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="manufacturer" render={({ field }) => (
                <FormItem>
                  <FormLabel>Manufacturer</FormLabel>
                  <FormControl><Input placeholder="Mettler Toledo" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="modelNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Model Number</FormLabel>
                  <FormControl><Input placeholder="ME204" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Measurement Specifications</p>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="minRange" render={({ field }) => (
                <FormItem>
                  <FormLabel>Min Range</FormLabel>
                  <FormControl><Input placeholder="1 g" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="maxRange" render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Range</FormLabel>
                  <FormControl><Input placeholder="200 g" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="capacity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacity</FormLabel>
                  <FormControl><Input placeholder="200 g" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="leastCount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Least Count</FormLabel>
                  <FormControl><Input placeholder="0.01 g" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Verification (In-house)</p>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="lastVerifiedOn" render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Verified On</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="nextVerificationDue" render={({ field }) => (
                <FormItem>
                  <FormLabel>Next Verification Due</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="verificationIntervalDays" render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification Interval (days)</FormLabel>
                  <FormControl><Input type="number" min="1" placeholder="1" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="formVerificationNo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Form Veri No.</FormLabel>
                  <FormControl><Input placeholder="FV-001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Calibration (External Lab)</p>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="nextCalibrationDue" render={({ field }) => (
                <FormItem>
                  <FormLabel>Next Calibration Due</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="calibrationIntervalDays" render={({ field }) => (
                <FormItem>
                  <FormLabel>Calibration Interval (days)</FormLabel>
                  <FormControl><Input type="number" min="1" placeholder="365" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="formCalibrationNo" render={({ field }) => (
              <FormItem>
                <FormLabel>Form Cali No.</FormLabel>
                <FormControl><Input placeholder="FC-001" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                Add Scale
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
