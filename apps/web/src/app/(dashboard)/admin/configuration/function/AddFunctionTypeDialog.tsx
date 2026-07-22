"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Code2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"

import { useAuth } from "@/lib/auth/useAuth"
import { apiCreateFunctionType, type FunctionTypeItem, ApiError } from "@/lib/auth/api"

const schema = z.object({
  functionTypeName:      z.string().min(1, "Name is required").max(100),
  functionTypeDetails:   z.string().max(2000).optional(),
  canSignOff:            z.boolean(),
  canOperateBatch:       z.boolean(),
  canPerformCleaning:    z.boolean(),
  canPerformMaintenance: z.boolean(),
  displayOrder:          z.coerce.number().int().min(0),
})

type FormInput  = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface Props {
  open:      boolean
  onClose:   () => void
  onCreated: (item: FunctionTypeItem) => void
}

export function AddFunctionTypeDialog({ open, onClose, onCreated }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      functionTypeName:      "",
      functionTypeDetails:   "",
      canSignOff:            false,
      canOperateBatch:       false,
      canPerformCleaning:    false,
      canPerformMaintenance: false,
      displayOrder:          0,
    },
  })

  async function onSubmit(values: FormValues) {
    const token = getAccessToken()
    if (!token) return
    setSubmitError(null)
    try {
      const created = await apiCreateFunctionType(token, {
        functionTypeName:      values.functionTypeName,
        functionTypeDetails:   values.functionTypeDetails || undefined,
        canSignOff:            values.canSignOff,
        canOperateBatch:       values.canOperateBatch,
        canPerformCleaning:    values.canPerformCleaning,
        canPerformMaintenance: values.canPerformMaintenance,
        displayOrder:          values.displayOrder,
      })
      onCreated(created)
      form.reset()
      onClose()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "An unexpected error occurred")
    }
  }

  function handleClose() {
    form.reset()
    setSubmitError(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="size-5 text-primary" />
            Add Function Type
          </DialogTitle>
          <DialogDescription>
            The Function Type ID (FT-001, FT-002…) will be generated automatically.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            {/* Name */}
            <FormField
              control={form.control}
              name="functionTypeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Function Type Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Supervision" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Details */}
            <FormField
              control={form.control}
              name="functionTypeDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Details</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Capability flags */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Capabilities</p>
              <div className="rounded-lg border p-3 space-y-2">
                {(
                  [
                    { name: "canSignOff"            as const, label: "Can Sign Off",           desc: "Can digitally sign off batch and cleaning steps" },
                    { name: "canOperateBatch"        as const, label: "Can Operate Batch",      desc: "Can be assigned as operator on batch process steps" },
                    { name: "canPerformCleaning"     as const, label: "Can Perform Cleaning",   desc: "Can record room and equipment cleaning log entries" },
                    { name: "canPerformMaintenance"  as const, label: "Can Perform Maintenance",desc: "Can record equipment maintenance log entries" },
                  ]
                ).map(({ name, label, desc }) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 accent-primary"
                          checked={field.value}
                          onChange={field.onChange}
                        />
                        <span>
                          <span className="text-sm font-medium group-hover:text-primary transition-colors">{label}</span>
                          <span className="block text-xs text-muted-foreground">{desc}</span>
                        </span>
                      </label>
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Display Order */}
            <FormField
              control={form.control}
              name="displayOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Order</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} placeholder="0" {...field} />
                  </FormControl>
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
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
