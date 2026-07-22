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
import { apiUpdateProcessType, type ProcessTypeItem, ApiError } from "@/lib/auth/api"

const schema = z.object({
  processType:        z.string().min(1, "Name is required").max(150),
  processDetails:     z.string().max(2000).optional(),
  processGroup:       z.string().max(100).optional(),
  typicalDurationMin: z.coerce.number().int().min(1).optional().or(z.literal("")),
  requiresCleanRoom:  z.boolean(),
  displayOrder:       z.coerce.number().int().min(0),
  isActive:           z.enum(["true", "false"]),
})

type FormInput  = z.input<typeof schema>
type FormValues = z.output<typeof schema>

interface Props {
  item:       ProcessTypeItem | null
  onClose:    () => void
  onUpdated:  (item: ProcessTypeItem) => void
  groups:     string[]
}

export function EditProcessTypeDialog({ item, onClose, onUpdated, groups }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      processType: "", processDetails: "", processGroup: "",
      typicalDurationMin: "", requiresCleanRoom: false,
      displayOrder: 0, isActive: "true",
    },
  })

  useEffect(() => {
    if (item) {
      form.reset({
        processType:        item.processType,
        processDetails:     item.processDetails     ?? "",
        processGroup:       item.processGroup       ?? "",
        typicalDurationMin: item.typicalDurationMin ?? "",
        requiresCleanRoom:  item.requiresCleanRoom,
        displayOrder:       item.displayOrder,
        isActive:           item.isActive ? "true" : "false",
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
      const updated = await apiUpdateProcessType(token, item.id, {
        processType:        values.processType,
        processDetails:     values.processDetails || null,
        processGroup:       values.processGroup   || null,
        typicalDurationMin: values.typicalDurationMin !== "" ? Number(values.typicalDurationMin) : null,
        requiresCleanRoom:  values.requiresCleanRoom,
        displayOrder:       values.displayOrder,
        isActive:           values.isActive === "true",
      })
      onUpdated(updated)
      onClose()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "An unexpected error occurred")
    }
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-5 text-primary" />
            Edit Process Type
          </DialogTitle>
          <DialogDescription>
            ID: <span className="font-mono font-medium">{item?.processId}</span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <FormField control={form.control} name="processType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Process Type Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="processDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Details</FormLabel>
                  <FormControl><Input placeholder="Optional description" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="processGroup"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group</FormLabel>
                    <FormControl>
                      <Input list="process-groups-edit" placeholder="e.g. Primary Manufacturing" {...field} />
                    </FormControl>
                    <datalist id="process-groups-edit">
                      {groups.map((g) => <option key={g} value={g} />)}
                    </datalist>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="typicalDurationMin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Typical Duration (min)</FormLabel>
                    <FormControl><Input type="number" min={1} placeholder="60" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="isActive"
                render={({ field }) => (
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
                )}
              />

              <FormField control={form.control} name="requiresCleanRoom"
                render={({ field }) => (
                  <FormItem className="flex flex-col justify-end pb-1">
                    <FormLabel>Clean Room</FormLabel>
                    <FormControl>
                      <label className="flex items-center gap-2 cursor-pointer mt-2">
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="size-4 rounded border-input accent-primary"
                        />
                        <span className="text-sm text-muted-foreground">Required</span>
                      </label>
                    </FormControl>
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
