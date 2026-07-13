"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, GitBranch } from "lucide-react"

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
import { apiCreateProcessType, type ProcessTypeItem, ApiError } from "@/lib/auth/api"

const schema = z.object({
  processType:        z.string().min(1, "Name is required").max(150),
  processDetails:     z.string().max(2000).optional(),
  processGroup:       z.string().max(100).optional(),
  typicalDurationMin: z.coerce.number().int().min(1).optional().or(z.literal("")),
  requiresCleanRoom:  z.boolean().optional(),
  displayOrder:       z.coerce.number().int().min(0).optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open:       boolean
  onClose:    () => void
  onCreated:  (item: ProcessTypeItem) => void
  groups:     string[]
}

export function AddProcessTypeDialog({ open, onClose, onCreated, groups }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      processType: "", processDetails: "", processGroup: "",
      typicalDurationMin: "", requiresCleanRoom: false, displayOrder: 0,
    },
  })

  async function onSubmit(values: FormValues) {
    const token = getAccessToken()
    if (!token) return
    setSubmitError(null)
    try {
      const created = await apiCreateProcessType(token, {
        processType:        values.processType,
        processDetails:     values.processDetails   || undefined,
        processGroup:       values.processGroup     || undefined,
        typicalDurationMin: values.typicalDurationMin !== "" ? Number(values.typicalDurationMin) : null,
        requiresCleanRoom:  values.requiresCleanRoom ?? false,
        displayOrder:       values.displayOrder ?? 0,
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="size-5 text-primary" />
            Add Process Type
          </DialogTitle>
          <DialogDescription>
            The Process ID (PR-001, PR-002…) will be generated automatically.
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
                  <FormControl><Input placeholder="e.g. Granulation" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="processDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Details</FormLabel>
                  <FormControl><Input placeholder="Optional description of this process" {...field} /></FormControl>
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
                      <Input
                        list="process-groups-add"
                        placeholder="e.g. Primary Manufacturing"
                        {...field}
                      />
                    </FormControl>
                    <datalist id="process-groups-add">
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

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl><Input type="number" min={0} placeholder="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField control={form.control} name="requiresCleanRoom"
                render={({ field }) => (
                  <FormItem className="flex flex-col justify-end pb-0.5">
                    <FormLabel>Requires Clean Room</FormLabel>
                    <FormControl>
                      <label className="flex items-center gap-2 cursor-pointer mt-2">
                        <input
                          type="checkbox"
                          checked={field.value ?? false}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="size-4 rounded border-input accent-primary"
                        />
                        <span className="text-sm text-muted-foreground">Yes</span>
                      </label>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                Add Process Type
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
