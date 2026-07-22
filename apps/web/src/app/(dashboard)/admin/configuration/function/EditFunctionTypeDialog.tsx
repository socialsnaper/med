"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Pencil } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"

import { useAuth } from "@/lib/auth/useAuth"
import { apiUpdateFunctionType, type FunctionTypeItem, ApiError } from "@/lib/auth/api"

const schema = z.object({
  functionTypeName:      z.string().min(1, "Name is required").max(100),
  functionTypeDetails:   z.string().max(2000).optional(),
  canSignOff:            z.boolean(),
  canOperateBatch:       z.boolean(),
  canPerformCleaning:    z.boolean(),
  canPerformMaintenance: z.boolean(),
  displayOrder:          z.coerce.number().int().min(0),
  isActive:              z.enum(["true", "false"]),
})

type FormValues = z.output<typeof schema>

interface Props {
  item:      FunctionTypeItem | null
  onClose:   () => void
  onUpdated: (item: FunctionTypeItem) => void
}

export function EditFunctionTypeDialog({ item, onClose, onUpdated }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      functionTypeName:      "",
      functionTypeDetails:   "",
      canSignOff:            false,
      canOperateBatch:       false,
      canPerformCleaning:    false,
      canPerformMaintenance: false,
      displayOrder:          0,
      isActive:              "true",
    },
  })

  useEffect(() => {
    if (item) {
      form.reset({
        functionTypeName:      item.functionTypeName,
        functionTypeDetails:   item.functionTypeDetails ?? "",
        canSignOff:            item.canSignOff,
        canOperateBatch:       item.canOperateBatch,
        canPerformCleaning:    item.canPerformCleaning,
        canPerformMaintenance: item.canPerformMaintenance,
        displayOrder:          item.displayOrder,
        isActive:              item.isActive ? "true" : "false",
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
      const updated = await apiUpdateFunctionType(token, item.id, {
        functionTypeName:      values.functionTypeName,
        functionTypeDetails:   values.functionTypeDetails || null,
        canSignOff:            values.canSignOff,
        canOperateBatch:       values.canOperateBatch,
        canPerformCleaning:    values.canPerformCleaning,
        canPerformMaintenance: values.canPerformMaintenance,
        displayOrder:          values.displayOrder,
        isActive:              values.isActive === "true",
      })
      onUpdated(updated)
      onClose()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "An unexpected error occurred")
    }
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-5 text-primary" />
            Edit Function Type
          </DialogTitle>
          <DialogDescription>
            ID: <span className="font-mono font-medium">{item?.functionTypeId}</span>
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
                  <FormControl><Input {...field} /></FormControl>
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
                  <FormControl><Input placeholder="Optional description" {...field} /></FormControl>
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
                          checked={field.value as boolean}
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

            {/* Display Order + Status */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
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
