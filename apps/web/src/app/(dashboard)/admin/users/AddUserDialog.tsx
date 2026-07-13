"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, UserPlus } from "lucide-react"

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
  apiCreateUser,
  apiGetRoles,
  type RoleItem,
  type UserListItem,
  ApiError,
} from "@/lib/auth/api"

// ── Validation ─────────────────────────────────────────────────────────────────

const addUserSchema = z.object({
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

type AddUserValues = z.infer<typeof addUserSchema>

// ── Props ─────────────────────────────────────────────────────────────────────

interface AddUserDialogProps {
  open:     boolean
  onClose:  () => void
  onCreated: (user: UserListItem) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AddUserDialog({ open, onClose, onCreated }: AddUserDialogProps) {
  const { getAccessToken } = useAuth()

  const [roles,       setRoles]       = useState<RoleItem[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<AddUserValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      firstName:     "",
      lastName:      "",
      email:         "",
      roleId:        "",
      employeeCode:  "",
      dateOfJoining: "",
    },
  })

  // Load roles when the dialog opens
  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function loadRoles() {
      const token = getAccessToken()
      if (!token) return
      setRolesLoading(true)
      try {
        const data = await apiGetRoles(token)
        if (!cancelled) setRoles(data)
      } catch {
        // Roles failed to load — user will see an empty dropdown
      } finally {
        if (!cancelled) setRolesLoading(false)
      }
    }

    loadRoles()
    return () => { cancelled = true }
  }, [open, getAccessToken])

  // Reset form and errors when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset()
      setSubmitError(null)
    }
  }, [open, form])

  async function onSubmit(values: AddUserValues) {
    setSubmitError(null)
    const token = getAccessToken()
    if (!token) {
      setSubmitError("Session expired. Please log in again.")
      return
    }

    try {
      const newUser = await apiCreateUser(token, {
        firstName:     values.firstName,
        lastName:      values.lastName,
        email:         values.email,
        roleId:        values.roleId,
        employeeCode:  values.employeeCode   || undefined,
        dateOfJoining: values.dateOfJoining  || undefined,
      })
      onCreated(newUser)
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

  const isSubmitting = form.formState.isSubmitting

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5" />
            Add New User
          </DialogTitle>
          <DialogDescription>
            A temporary password will be generated and emailed to the user.
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
                    <FormControl>
                      <Input placeholder="Jane" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input placeholder="Smith" {...field} />
                    </FormControl>
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
                  <FormControl>
                    <Input type="email" placeholder="jane.smith@company.com" {...field} />
                  </FormControl>
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
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={rolesLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={rolesLoading ? "Loading roles…" : "Select a role"}
                        />
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
                    <FormControl>
                      <Input placeholder="EMP001" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
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
                {isSubmitting ? "Creating…" : "Create user"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
