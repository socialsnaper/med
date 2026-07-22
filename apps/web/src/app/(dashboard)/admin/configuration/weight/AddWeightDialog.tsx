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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/lib/auth/useAuth"
import { apiCreateWeight, type StandardWeightItem, ApiError } from "@/lib/auth/api"

const schema = z.object({
  weightSerialNo:          z.string().min(1, "Serial number is required").max(20),
  standardWeight:          z.string().min(1, "Standard weight is required").max(20),
  weightValueGrams:        z.coerce.number({ invalid_type_error: "Must be a number" }).positive("Must be positive"),
  lastCalibratedOn:        z.string().optional(),
  nextCalibrationDue:      z.string().optional(),
  calibrationIntervalDays: z.coerce.number().int().min(1).optional(),
  toleranceLimit:          z.string().max(20).optional(),
  material:                z.string().max(100).optional(),
  accuracyClass:           z.string().max(20).optional(),
  storageLocation:         z.string().max(150).optional(),
  calibrationLab:          z.string().max(150).optional(),
  certificateNumber:       z.string().max(100).optional(),
  isActive:                z.boolean(),
})

type FormInput  = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface Props {
  open:      boolean
  onClose:   () => void
  onCreated: (item: StandardWeightItem) => void
}

export function AddWeightDialog({ open, onClose, onCreated }: Props) {
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
      isActive: true,
    },
  })

  async function onSubmit(values: FormValues) {
    const token = getAccessToken()
    if (!token) return
    setSubmitError(null)
    try {
      const created = await apiCreateWeight(token, {
        weightSerialNo:          values.weightSerialNo,
        standardWeight:          values.standardWeight,
        weightValueGrams:        values.weightValueGrams,
        lastCalibratedOn:        values.lastCalibratedOn        || null,
        nextCalibrationDue:      values.nextCalibrationDue      || null,
        calibrationIntervalDays: values.calibrationIntervalDays ?? 365,
        toleranceLimit:          values.toleranceLimit          || null,
        storageLocation:         values.storageLocation         || null,
        calibrationLab:          values.calibrationLab          || null,
        certificateNumber:       values.certificateNumber        || null,
        isActive:                values.isActive,
      })
      onCreated(created)
      form.reset()
      onClose()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to add weight")
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
          <DialogTitle>Add Standard Weight</DialogTitle>
          <DialogDescription>Register a new physical reference calibration weight.</DialogDescription>
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

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                Add Weight
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
