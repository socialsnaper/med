"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Package } from "lucide-react"

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
import {
  apiCreatePackagingType,
  PACKAGING_CATEGORIES,
  type PackagingTypeItem,
  ApiError,
} from "@/lib/auth/api"

const schema = z.object({
  packagingTypeName:    z.string().min(1, "Name is required").max(150),
  packagingTypeDetails: z.string().max(2000).optional(),
  packagingCategory:    z.string().optional(),
  primaryMaterial:      z.string().max(100).optional(),
  packUnit:             z.string().max(50).optional(),
  standardPackSize:     z.string().optional(),
  storageConditions:    z.string().max(150).optional(),
  displayOrder:         z.coerce.number().int().min(0).optional(),
})

type FormInput  = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface Props {
  open:      boolean
  onClose:   () => void
  onCreated: (item: PackagingTypeItem) => void
}

export function AddPackagingTypeDialog({ open, onClose, onCreated }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      packagingTypeName:    "",
      packagingTypeDetails: "",
      packagingCategory:    "",
      primaryMaterial:      "",
      packUnit:             "",
      standardPackSize:     "",
      storageConditions:    "",
      displayOrder:         0 as number | undefined,
    },
  })

  async function onSubmit(values: FormValues) {
    const token = getAccessToken()
    if (!token) return
    setSubmitError(null)
    try {
      const stdSize = values.standardPackSize ? parseInt(values.standardPackSize, 10) : undefined
      const created = await apiCreatePackagingType(token, {
        packagingTypeName:    values.packagingTypeName,
        packagingTypeDetails: values.packagingTypeDetails || undefined,
        packagingCategory:    (values.packagingCategory as never) || undefined,
        primaryMaterial:      values.primaryMaterial || undefined,
        packUnit:             values.packUnit || undefined,
        standardPackSize:     stdSize && stdSize > 0 ? stdSize : undefined,
        storageConditions:    values.storageConditions || undefined,
        displayOrder:         values.displayOrder ?? 0,
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-5 text-primary" />
            Add Packaging Type
          </DialogTitle>
          <DialogDescription>
            The Packaging Type ID (PT-001, PT-002…) will be generated automatically.
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
              name="packagingTypeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Packaging Type Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Blister Pack" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Details */}
            <FormField
              control={form.control}
              name="packagingTypeDetails"
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

            {/* Category */}
            <FormField
              control={form.control}
              name="packagingCategory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PACKAGING_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Primary Material + Pack Unit */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="primaryMaterial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Material</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. PVC / Aluminium" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="packUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pack Unit</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Tablets per blister" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Std Pack Size + Display Order */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="standardPackSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Standard Pack Size</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} placeholder="e.g. 10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
            </div>

            {/* Storage Conditions */}
            <FormField
              control={form.control}
              name="storageConditions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Storage Conditions</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Store below 30°C" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
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
