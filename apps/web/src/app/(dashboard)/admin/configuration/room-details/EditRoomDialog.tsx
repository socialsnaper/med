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
import { apiUpdateRoom, type RoomItem, type RoomTypeItem, ApiError } from "@/lib/auth/api"

const schema = z.object({
  roomName:    z.string().min(1, "Room name is required").max(150),
  roomTypeId:  z.string().optional(),
  floor:       z.string().max(50).optional(),
  building:    z.string().max(100).optional(),
  roomDetails: z.string().max(2000).optional(),
  isActive:    z.enum(["true", "false"]),
})

type FormValues = z.output<typeof schema>

interface Props {
  item:       RoomItem | null
  roomTypes:  RoomTypeItem[]
  onClose:    () => void
  onUpdated:  (item: RoomItem) => void
}

export function EditRoomDialog({ item, roomTypes, onClose, onUpdated }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      roomName: "", roomTypeId: "__none__", floor: "",
      building: "", roomDetails: "", isActive: "true",
    },
  })

  useEffect(() => {
    if (item) {
      form.reset({
        roomName:    item.roomName,
        roomTypeId:  item.roomTypeId ?? "__none__",
        floor:       item.floor       ?? "",
        building:    item.building    ?? "",
        roomDetails: item.roomDetails ?? "",
        isActive:    item.isActive ? "true" : "false",
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
      const updated = await apiUpdateRoom(token, item.id, {
        roomName:    values.roomName,
        roomTypeId:  values.roomTypeId === "__none__" ? null : (values.roomTypeId || null),
        floor:       values.floor       || null,
        building:    values.building    || null,
        roomDetails: values.roomDetails || null,
        isActive:    values.isActive === "true",
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
            Edit Room
          </DialogTitle>
          <DialogDescription>
            ID: <span className="font-mono font-medium">{item?.roomId}</span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            {/* Room Name */}
            <FormField
              control={form.control}
              name="roomName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Room Type */}
            <FormField
              control={form.control}
              name="roomTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="— None —" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {roomTypes.map((rt) => (
                        <SelectItem key={rt.id} value={rt.id}>
                          {rt.roomTypeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Floor & Building */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="floor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Floor</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Ground Floor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="building"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Building / Block</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Block A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Details & Status */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="roomDetails"
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel>Details</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional notes" {...field} />
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
                {form.formState.isSubmitting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
