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
import { apiUpdateRoomType, type RoomTypeItem, ApiError } from "@/lib/auth/api"

const schema = z.object({
  roomTypeName:    z.string().min(1, "Name is required").max(150),
  roomTypeDetails: z.string().max(1000).optional(),
  displayOrder:    z.coerce.number().int().min(0),
  isActive:        z.enum(["true", "false"]),
})

type FormValues = z.infer<typeof schema>

interface Props {
  item:      RoomTypeItem | null
  onClose:   () => void
  onUpdated: (item: RoomTypeItem) => void
}

export function EditRoomTypeDialog({ item, onClose, onUpdated }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      roomTypeName:    "",
      roomTypeDetails: "",
      displayOrder:    0,
      isActive:        "true",
    },
  })

  // Populate form when item changes
  useEffect(() => {
    if (item) {
      form.reset({
        roomTypeName:    item.roomTypeName,
        roomTypeDetails: item.roomTypeDetails ?? "",
        displayOrder:    item.displayOrder,
        isActive:        item.isActive ? "true" : "false",
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
      const updated = await apiUpdateRoomType(token, item.id, {
        roomTypeName:    values.roomTypeName,
        roomTypeDetails: values.roomTypeDetails || null,
        displayOrder:    values.displayOrder,
        isActive:        values.isActive === "true",
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
            Edit Room Type
          </DialogTitle>
          <DialogDescription>
            ID: <span className="font-mono font-medium">{item?.roomTypeId}</span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="roomTypeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room Type Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="roomTypeDetails"
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
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
                    <Select value={field.value} onValueChange={field.onChange}>
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
