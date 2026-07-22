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
import {
  apiUpdatePackagingType,
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
  displayOrder:         z.coerce.number().int().min(0),
  isActive:             z.enum(["true", "false"]),
})

type FormInput  = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface Props {
  item:      PackagingTypeItem | null
  onClose:   () => void
  onUpdated: (item: PackagingTypeItem) => void
}

export function EditPackagingTypeDialog({ item, onClose, onUpdated }: Props) {
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
      displayOrder:         0,
      isActive:             "true",
    },
  })

  useEffect(() => {
    if (item) {
      form.reset({
        packagingTypeName:    item.packagingTypeName,
        packagingTypeDetails: item.packagingTypeDetails ?? "",
        packagingCategory:    item.packagingCategory    ?? "",
        primaryMaterial:      item.primaryMaterial      ?? "",
        packUnit:             item.packUnit             ?? "",
        standardPackSize:     item.standardPackSize != null ? String(item.standardPackSize) : "",
        storageConditions:    item.storageConditions    ?? "",
        displayOrder:         item.displayOrder,
        isActive:             item.isActive ? "true" : "false",
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
      const stdSize = values.standardPackSize ? parseInt(values.standardPackSize, 10) : null
      const updated = await apiUpdatePackagingType(token, item.id, {
        packagingTypeName:    values.packagingTypeName,
        packagingTypeDetails: values.packagingTypeDetails || null,
        packagingCategory:    (values.packagingCategory as never) || null,
        primaryMaterial:      values.primaryMaterial || null,
        packUnit:             values.packUnit || null,
        standardPackSize:     stdSize && stdSize > 0 ? stdSize : null,
        storageConditions:    values.storageConditions || null,
        displayOrder:         values.displayOrder,
        isActive:             values.isActive === "true",
      })
      onUpdated(updated)
      onClose()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "An unexpected error occurred")
    }
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-5 text-primary" />
            Edit Packaging Type
          </DialogTitle>
          <DialogDescription>
            ID: <span className="font-mono font-medium">{item?.packagingTypeId}</span>
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
                  <FormControl><Input {...field} /></FormControl>
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
                  <FormControl><Input placeholder="Optional description" {...field} /></FormControl>
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
                      <SelectItem value="">— None —</SelectItem>
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
                    <FormControl><Input {...field} /></FormControl>
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
                    <FormControl><Input {...field} /></FormControl>
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
                    <FormControl><Input type="number" min={1} {...field} /></FormControl>
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
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
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
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status */}
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

            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
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
