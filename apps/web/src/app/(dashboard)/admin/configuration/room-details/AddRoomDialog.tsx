"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, DoorOpen } from "lucide-react"

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
import { apiCreateRoom, type RoomItem, type RoomTypeItem, ApiError } from "@/lib/auth/api"

const schema = z.object({
  roomName:    z.string().min(1, "Room name is required").max(150),
  roomTypeId:  z.string().optional(),
  floor:       z.string().max(50).optional(),
  building:    z.string().max(100).optional(),
  roomDetails: z.string().max(2000).optional(),
})

type FormValues = z.output<typeof schema>

interface Props {
  open:       boolean
  roomTypes:  RoomTypeItem[]
  onClose:    () => void
  onCreated:  (item: RoomItem) => void
}

export function AddRoomDialog({ open, roomTypes, onClose, onCreated }: Props) {
  const { getAccessToken } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { roomName: "", roomTypeId: "__none__", floor: "", building: "", roomDetails: "" },
  })

  async function onSubmit(values: FormValues) {
    const token = getAccessToken()
    if (!token) return
    setSubmitError(null)
    try {
      const created = await apiCreateRoom(token, {
        roomName:    values.roomName,
        roomTypeId:  values.roomTypeId === "__none__" ? undefined : (values.roomTypeId || undefined),
        floor:       values.floor       || undefined,
        building:    values.building    || undefined,
        roomDetails: values.roomDetails || undefined,
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
            <DoorOpen className="size-5 text-primary" />
            Add Room
          </DialogTitle>
          <DialogDescription>
            Room ID (RM-001, RM-002…) will be generated automatically.
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
                    <Input placeholder="e.g. Granulation Room A" {...field} />
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
                        <SelectValue placeholder="— Select room type —" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">— Select room type —</SelectItem>
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

            {/* Details */}
            <FormField
              control={form.control}
              name="roomDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Details</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional notes about this room" {...field} />
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
                {form.formState.isSubmitting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Add Room
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
