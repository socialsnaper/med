"use client"

import { useState, useEffect } from "react"
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
  apiUpdateScale, type ScaleItem,
  SCALE_TYPES, SCALE_STATUSES, ApiError,
} from "@/lib/auth/api"

const schema = z.object({
  scaleNumber:              z.string().min(1, "Scale number is required").max(50),
  scaleType:                z.enum(["analytical", "precision", "industrial", "moisture", "other", "_none"]),
  minRange:                 z.string().max(20).optional(),
  maxRange:                 z.string().max(20).optional(),
  capacity:                 z.string().max(20).optional(),
  leastCount:               z.string().max(20).optional(),
  manufacturer:             z.string().max(100).optional(),
  modelNumber:              z.string().max(100).optional(),
  lastVerifiedOn:           z.string().optional(),
  nextVerificationDue:      z.string().optional(),
  verificationIntervalDays: z.coerce.number().int().min(1),
  formVerificationNo:       z.string().max(20).optional(),
  nextCalibrationDue:       z.string().optional(),
  calibrationIntervalDays:  z.coerce.number().int().min(1),
  formCalibrationNo:        z.string().max(20).optional(),
  status:                   z.enum(["active", "quarantined", "under_repair", "retired"]),
  statusReason:             z.string().optional(),
  isActive:                 z.enum(["true", "false"]),
})

type FormValues = z.output<typeof schema>

const TYPE_LABELS: Record<string, string> = {
  analytical: "Analytical", precision: "Precision",
  industrial: "Industrial", moisture: "Moisture", other: "Other",
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active", quarantined: "Quarantined",
  under_repair: "Under Repair", retired: "Retired",
}

interface Props {
  open:      boolean
  item:      ScaleItem | null
  onClose:   () => void
  onUpdated: (item: ScaleItem) => void
}

export function EditScaleDialog({ open, item, onClose, onUpdated }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      scaleNumber: "", scaleType: "_none",
      minRange: "", maxRange: "", capacity: "", leastCount: "",
      manufacturer: "", modelNumber: "",
      lastVerifiedOn: "", nextVerificationDue: "",
      verificationIntervalDays: 1, formVerificationNo: "",
      nextCalibrationDue: "", calibrationIntervalDays: 365, formCalibrationNo: "",
      status: "active", statusReason: "", isActive: "true",
    },
  })

  const statusWatch   = form.watch("status")
  const isActiveWatch = form.watch("isActive")

  useEffect(() => {
    if (item) {
      form.reset({
        scaleNumber:              item.scaleNumber,
        scaleType:                (item.scaleType as FormValues["scaleType"]) ?? "_none",
        minRange:                 item.minRange              ?? "",
        maxRange:                 item.maxRange              ?? "",
        capacity:                 item.capacity              ?? "",
        leastCount:               item.leastCount            ?? "",
        manufacturer:             item.manufacturer          ?? "",
        modelNumber:              item.modelNumber           ?? "",
        lastVerifiedOn:           item.lastVerifiedOn        ?? "",
        nextVerificationDue:      item.nextVerificationDue   ?? "",
        verificationIntervalDays: item.verificationIntervalDays,
        formVerificationNo:       item.formVerificationNo    ?? "",
        nextCalibrationDue:       item.nextCalibrationDue    ?? "",
        calibrationIntervalDays:  item.calibrationIntervalDays,
        formCalibrationNo:        item.formCalibrationNo     ?? "",
        status:                   item.status as FormValues["status"],
        statusReason:             item.statusReason          ?? "",
        isActive:                 item.isActive ? "true" : "false",
      })
    }
  }, [item, form])

  async function onSubmit(values: FormValues) {
    const token = getAccessToken()
    if (!token || !item) return
    setSubmitError(null)
    try {
      const updated = await apiUpdateScale(token, item.id, {
        scaleNumber:              values.scaleNumber,
        scaleType:                values.scaleType === "_none" ? null : values.scaleType,
        minRange:                 values.minRange              || null,
        maxRange:                 values.maxRange              || null,
        capacity:                 values.capacity              || null,
        leastCount:               values.leastCount            || null,
        manufacturer:             values.manufacturer          || null,
        modelNumber:              values.modelNumber           || null,
        lastVerifiedOn:           values.lastVerifiedOn        || null,
        nextVerificationDue:      values.nextVerificationDue   || null,
        verificationIntervalDays: values.verificationIntervalDays,
        formVerificationNo:       values.formVerificationNo    || null,
        nextCalibrationDue:       values.nextCalibrationDue    || null,
        calibrationIntervalDays:  values.calibrationIntervalDays,
        formCalibrationNo:        values.formCalibrationNo     || null,
        status:                   values.status,
        statusReason:             values.status !== "active" ? (values.statusReason || null) : null,
        isActive:                 values.isActive === "true",
      })
      onUpdated(updated)
      onClose()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to update scale")
    }
  }

  function handleClose() {
    setSubmitError(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Scale</DialogTitle>
          <DialogDescription>
            Update details for <span className="font-mono font-medium">{item?.scaleId}</span> — {item?.scaleNumber}
          </DialogDescription>
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
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="_none">— None —</SelectItem>
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
                <FormItem><FormLabel>Min Range</FormLabel><FormControl><Input placeholder="1 g" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="maxRange" render={({ field }) => (
                <FormItem><FormLabel>Max Range</FormLabel><FormControl><Input placeholder="200 g" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="capacity" render={({ field }) => (
                <FormItem><FormLabel>Capacity</FormLabel><FormControl><Input placeholder="200 g" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="leastCount" render={({ field }) => (
                <FormItem><FormLabel>Least Count</FormLabel><FormControl><Input placeholder="0.01 g" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Verification (In-house)</p>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="lastVerifiedOn" render={({ field }) => (
                <FormItem><FormLabel>Last Verified On</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="nextVerificationDue" render={({ field }) => (
                <FormItem><FormLabel>Next Verification Due</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="verificationIntervalDays" render={({ field }) => (
                <FormItem><FormLabel>Interval (days)</FormLabel><FormControl><Input type="number" min="1" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="formVerificationNo" render={({ field }) => (
                <FormItem><FormLabel>Form Veri No.</FormLabel><FormControl><Input placeholder="FV-001" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Calibration (External Lab)</p>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="nextCalibrationDue" render={({ field }) => (
                <FormItem><FormLabel>Next Calibration Due</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="calibrationIntervalDays" render={({ field }) => (
                <FormItem><FormLabel>Interval (days)</FormLabel><FormControl><Input type="number" min="1" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="formCalibrationNo" render={({ field }) => (
              <FormItem><FormLabel>Form Cali No.</FormLabel><FormControl><Input placeholder="FC-001" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Status</p>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Operational Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {SCALE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem>
                  <FormLabel>Record Active</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {statusWatch !== "active" && (
              <FormField control={form.control} name="statusReason" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status Reason</FormLabel>
                  <FormControl><Input placeholder="e.g. Failed verification on 2025-03-01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
