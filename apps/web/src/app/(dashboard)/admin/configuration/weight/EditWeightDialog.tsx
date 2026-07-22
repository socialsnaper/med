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
import { apiUpdateWeight, type StandardWeightItem, ApiError } from "@/lib/auth/api"

const schema = z.object({
  weightSerialNo:          z.string().min(1, "Serial number is required").max(20),
  standardWeight:          z.string().min(1, "Standard weight is required").max(20),
  weightValueGrams:        z.coerce.number({ invalid_type_error: "Must be a number" }).positive("Must be positive"),
  lastCalibratedOn:        z.string().optional(),
  nextCalibrationDue:      z.string().optional(),
  calibrationIntervalDays: z.coerce.number().int().min(1),
  toleranceLimit:          z.string().max(20).optional(),
  material:                z.string().max(100).optional(),
  accuracyClass:           z.string().max(20).optional(),
  storageLocation:         z.string().max(150).optional(),
  calibrationLab:          z.string().max(150).optional(),
  certificateNumber:       z.string().max(100).optional(),
  isActive:                z.enum(["true", "false"]),
  inactiveReason:          z.string().optional(),
})

type FormInput  = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface Props {
  open:      boolean
  item:      StandardWeightItem | null
  onClose:   () => void
  onUpdated: (item: StandardWeightItem) => void
}

export function EditWeightDialog({ open, item, onClose, onUpdated }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      weightSerialNo: "", standardWeight: "", weightValueGrams: 0,
      lastCalibratedOn: "", nextCalibrationDue: "",
      calibrationIntervalDays: 365,
      toleranceLimit: "",
      storageLocation: "", calibrationLab: "", certificateNumber: "",
      isActive: "true", inactiveReason: "",
    },
  })

  const isActiveWatch = form.watch("isActive")

  useEffect(() => {
    if (item) {
      form.reset({
        weightSerialNo:          item.weightSerialNo,
        standardWeight:          item.standardWeight,
        weightValueGrams:        item.weightValueGrams,
        lastCalibratedOn:        item.lastCalibratedOn    ?? "",
        nextCalibrationDue:      item.nextCalibrationDue  ?? "",
        calibrationIntervalDays: item.calibrationIntervalDays,
        toleranceLimit:          item.toleranceLimit      ?? "",
        storageLocation:         item.storageLocation     ?? "",
        calibrationLab:          item.calibrationLab      ?? "",
        certificateNumber:       item.certificateNumber   ?? "",
        isActive:                item.isActive ? "true" : "false",
        inactiveReason:          item.inactiveReason      ?? "",
      })
    }
  }, [item, form])

  async function onSubmit(values: FormValues) {
    const token = getAccessToken()
    if (!token || !item) return
    setSubmitError(null)
    try {
      const updated = await apiUpdateWeight(token, item.id, {
        weightSerialNo:          values.weightSerialNo,
        standardWeight:          values.standardWeight,
        weightValueGrams:        values.weightValueGrams,
        lastCalibratedOn:        values.lastCalibratedOn        || null,
        nextCalibrationDue:      values.nextCalibrationDue      || null,
        calibrationIntervalDays: values.calibrationIntervalDays,
        toleranceLimit:          values.toleranceLimit          || null,
        storageLocation:         values.storageLocation         || null,
        calibrationLab:          values.calibrationLab          || null,
        certificateNumber:       values.certificateNumber        || null,
        isActive:                values.isActive === "true",
        inactiveReason:          values.isActive === "false" ? (values.inactiveReason || null) : null,
      })
      onUpdated(updated)
      onClose()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to update weight")
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
          <DialogTitle>Edit Standard Weight</DialogTitle>
          <DialogDescription>
            Update calibration details for <span className="font-mono font-medium">{item?.weightSerialNo}</span>
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
              <FormField control={form.control} name="weightSerialNo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Serial No <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="WT-001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="standardWeight" render={({ field }) => (
                <FormItem>
                  <FormLabel>Standard Weight <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="1 kg" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="weightValueGrams" render={({ field }) => (
                <FormItem>
                  <FormLabel>Value (grams) <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="number" step="0.0001" placeholder="1000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="toleranceLimit" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tolerance Limit</FormLabel>
                  <FormControl><Input placeholder="±0.01 g" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="lastCalibratedOn" render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Calibrated On</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="nextCalibrationDue" render={({ field }) => (
                <FormItem>
                  <FormLabel>Next Calibration Due</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="calibrationIntervalDays" render={({ field }) => (
                <FormItem>
                  <FormLabel>Calibration Interval (days)</FormLabel>
                  <FormControl><Input type="number" min="1" placeholder="365" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="storageLocation" render={({ field }) => (
                <FormItem>
                  <FormLabel>Storage Location</FormLabel>
                  <FormControl><Input placeholder="QC Lab Cabinet 2" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="calibrationLab" render={({ field }) => (
                <FormItem>
                  <FormLabel>Calibration Lab</FormLabel>
                  <FormControl><Input placeholder="NABL Accredited Lab - Mumbai" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="certificateNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Certificate Number</FormLabel>
                  <FormControl><Input placeholder="CERT-2024-001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {isActiveWatch === "false" && (
                <FormField control={form.control} name="inactiveReason" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inactive Reason</FormLabel>
                    <FormControl><Input placeholder="e.g. Damaged — chipped edge" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>

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
