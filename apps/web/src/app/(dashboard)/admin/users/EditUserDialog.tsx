"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, UserCog, ShieldOff, ShieldCheck, AlertTriangle } from "lucide-react"

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
  apiUpdateUser,
  apiSetUserStatus,
  apiGetRoles,
  type RoleItem,
  type UserListItem,
  type UpdateUserPayload,
  ApiError,
} from "@/lib/auth/api"

// ── Validation ─────────────────────────────────────────────────────────────────

const editUserSchema = z.object({
  firstName:     z.string().min(1, "Required").max(100),
  lastName:      z.string().min(1, "Required").max(100),
  email:         z.string().email("Enter a valid email").max(255),
  roleId:        z.string().min(1, "Please select a role"),
  employeeCode:  z.string().max(50).optional(),
  dateOfJoining: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
})

type EditUserValues = z.infer<typeof editUserSchema>

// ── Props ─────────────────────────────────────────────────────────────────────

interface EditUserDialogProps {
  user:      UserListItem | null
  open:      boolean
  onClose:   () => void
  onUpdated: (user: UserListItem) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EditUserDialog({ user, open, onClose, onUpdated }: EditUserDialogProps) {
  const { getAccessToken } = useAuth()

  const [roles,         setRoles]         = useState<RoleItem[]>([])
  const [rolesLoading,  setRolesLoading]  = useState(false)
  const [submitError,   setSubmitError]   = useState<string | null>(null)
  // Status change confirmation state
  const [confirmStatus, setConfirmStatus] = useState(false)
  const [statusError,   setStatusError]   = useState<string | null>(null)
  const [statusPending, setStatusPending] = useState(false)

  const form = useForm<EditUserValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName:     "",
      lastName:      "",
      email:         "",
      roleId:        "",
      employeeCode:  "",
      dateOfJoining: "",
    },
  })

  // Sync form values when user changes
  useEffect(() => {
    if (user) {
      form.reset({
        firstName:     user.firstName,
        lastName:      user.lastName,
        email:         user.email,
        roleId:        user.role.id,
        employeeCode:  user.employeeCode ?? "",
        dateOfJoining: user.dateOfJoining
          ? new Date(user.dateOfJoining).toISOString().slice(0, 10)
          : "",
      })
    }
  }, [user, form])

  // Load roles when dialog opens
  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      const token = getAccessToken()
      if (!token) return
      setRolesLoading(true)
      try {
        const data = await apiGetRoles(token)
        if (!cancelled) setRoles(data)
      } catch { /* ignore */ }
      finally { if (!cancelled) setRolesLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [open, getAccessToken])

  // Reset local state when dialog closes
  useEffect(() => {
    if (!open) {
      setSubmitError(null)
      setConfirmStatus(false)
      setStatusError(null)
    }
  }, [open])

  // ── Save profile ──────────────────────────────────────────────────────────

  async function onSubmit(values: EditUserValues) {
    if (!user) return
    setSubmitError(null)
    const token = getAccessToken()
    if (!token) { setSubmitError("Session expired. Please log in again."); return }

    const payload: UpdateUserPayload = {
      firstName:     values.firstName,
      lastName:      values.lastName,
      email:         values.email,
      roleId:        values.roleId,
      employeeCode:  values.employeeCode  || null,
      dateOfJoining: values.dateOfJoining || null,
    }

    try {
      const updated = await apiUpdateUser(token, user.id, payload)
      onUpdated(updated)
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "EMAIL_TAKEN") {
          form.setError("email", { message: "This email is already in use" })
        } else if (err.code === "EMPLOYEE_CODE_TAKEN") {
          form.setError("employeeCode", { message: "Employee code already in use" })
        } else if (err.code === "ROLE_NOT_FOUND") {
          form.setError("roleId", { message: "Selected role no longer exists" })
        } else {
          setSubmitError(err.message)
        }
      } else {
        setSubmitError("An unexpected error occurred. Please try again.")
      }
    }
  }

  // ── Toggle status ─────────────────────────────────────────────────────────

  async function handleStatusChange() {
    if (!user) return
    setStatusError(null)
    setStatusPending(true)
    const token = getAccessToken()
    if (!token) { setStatusError("Session expired."); setStatusPending(false); return }

    try {
      const updated = await apiSetUserStatus(token, user.id, !user.isActive)
      onUpdated(updated)
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        setStatusError(err.message)
      } else {
        setStatusError("An unexpected error occurred.")
      }
    } finally {
      setStatusPending(false)
      setConfirmStatus(false)
    }
  }

  if (!user) return null

  const isSubmitting  = form.formState.isSubmitting
  const deactivating  = !user.isActive  // next action is to activate
  const fullName      = `${user.firstName} ${user.lastName}`

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="size-5" />
            Edit User
          </DialogTitle>
          <DialogDescription>
            Update profile details for{" "}
            <span className="font-medium text-foreground">{fullName}</span>
            <span className="ml-1.5 font-mono text-xs">({user.username})</span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Role */}
            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={rolesLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={rolesLoading ? "Loading…" : "Select a role"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.roleName}
                          {r.roleGroup && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              ({r.roleGroup})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Optional fields */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="employeeCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee code</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateOfJoining"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of joining</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
                {isSubmitting ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>

        {/* ── Danger zone ─────────────────────────────────────────────────── */}
        <div className="mt-2 rounded-lg border border-destructive/30 p-4">
          <p className="text-sm font-medium text-destructive mb-1">
            {user.isActive ? "Deactivate account" : "Reactivate account"}
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            {user.isActive
              ? "Blocks login immediately and revokes all active sessions. The account is never deleted."
              : "Restores login access for this user."}
          </p>

          {!confirmStatus ? (
            <Button
              type="button"
              variant={user.isActive ? "destructive" : "outline"}
              size="sm"
              onClick={() => { setStatusError(null); setConfirmStatus(true) }}
            >
              {user.isActive ? (
                <><ShieldOff className="size-4 mr-2" /> Deactivate</>
              ) : (
                <><ShieldCheck className="size-4 mr-2" /> Reactivate</>
              )}
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                <AlertTriangle className="size-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-destructive">
                  {user.isActive
                    ? `This will immediately block login for ${fullName}. Are you sure?`
                    : `This will restore login access for ${fullName}. Are you sure?`}
                </p>
              </div>

              {statusError && (
                <p className="text-xs text-destructive">{statusError}</p>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={user.isActive ? "destructive" : "default"}
                  onClick={handleStatusChange}
                  disabled={statusPending}
                >
                  {statusPending && <Loader2 className="size-4 mr-2 animate-spin" />}
                  {statusPending
                    ? (user.isActive ? "Deactivating…" : "Reactivating…")
                    : "Yes, confirm"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmStatus(false)}
                  disabled={statusPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
