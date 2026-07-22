"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, ClipboardList } from "lucide-react"

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
  apiCreateRoomCleaningSopStep,
  type RoomCleaningSopStepItem,
  type RoomCleaningTypeItem,
  SOP_CLEANING_METHODS,
  SOP_EQUIP_SEQUENCES,
  ApiError,
} from "@/lib/auth/api"

const METHOD_LABELS: Record<string, string> = {
  TypeA: "Type A — Dry",
  TypeB: "Type B — Wet",
  TypeC: "Type C — Sanitization",
}

const schema = z.object({
  cleaningTypeId:            z.string().min(1, "Cleaning type is required"),
  stepNumber:                z.coerce.number().int().min(1, "Step number must be ≥ 1"),
  timeAllottedDisplay:       z.string().max(10).optional(),
  cleaningMethod:            z.enum(SOP_CLEANING_METHODS),
  equipmentCleaningSequence: z.enum(SOP_EQUIP_SEQUENCES),
  procedureText:             z.string().min(1, "Procedure is required").max(5000),
  chemicalUsed:              z.string().max(200).optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open:          boolean
  onClose:       () => void
  onCreated:     (item: RoomCleaningSopStepItem) => void
  cleaningTypes: RoomCleaningTypeItem[]
  defaultTypeId?: string
}

export function AddSopStepDialog({ open, onClose, onCreated, cleaningTypes, defaultTypeId }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cleaningTypeId: defaultTypeId ?? "",
      stepNumber: 1,
      timeAllottedDisplay: "",
      cleaningMethod: "TypeB",
      equipmentCleaningSequence: "NA",
      procedureText: "",
      chemicalUsed: "",
    },
  })

  async function onSubmit(values: FormValues) {
    const token = getAccessToken()
    if (!token) return
    setSubmitError(null)
    try {
      const created = await apiCreateRoomCleaningSopStep(token, {
        cleaningTypeId:            values.cleaningTypeId,
        stepNumber:                values.stepNumber,
        timeAllottedDisplay:       values.timeAllottedDisplay || undefined,
        cleaningMethod:            values.cleaningMethod,
        equipmentCleaningSequence: values.equipmentCleaningSequence,
        procedureText:             values.procedureText,
        chemicalUsed:              values.chemicalUsed || undefined,
      })
      onCreated(created)
      form.reset({ ...form.getValues(), stepNumber: values.stepNumber + 1, procedureText: "", chemicalUsed: "" })
      onClose()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "An unexpected error occurred")
    }
  }

  function handleClose() { form.reset(); setSubmitError(null); onClose() }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="size-5 text-primary" /> Add SOP Step
          </DialogTitle>
          <DialogDescription>Add a new cleaning procedure step.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {submitError && (
              <Alert variant="destructive"><AlertDescription>{submitError}</AlertDescription></Alert>
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

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="cleaningMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dry/Wet/San <span className="text-destructive">*</span></FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {SOP_CLEANING_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="equipmentCleaningSequence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Before/After Equ.</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {SOP_EQUIP_SEQUENCES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="timeAllottedDisplay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Allotted</FormLabel>
                    <FormControl><Input placeholder="e.g. 00:10" {...field} /></FormControl>
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
                      placeholder="Describe the exact steps the operator must follow…"
                      className="min-h-24 resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="chemicalUsed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chemical Used</FormLabel>
                  <FormControl><Input placeholder="e.g. Detergent Solution, NA" {...field} /></FormControl>
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
                Add Step
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
