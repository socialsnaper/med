"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { apiChangePassword } from "@/lib/auth/api"
import { cn } from "@/lib/utils"

// ── Password strength ─────────────────────────────────────────────────────────

interface StrengthRule {
  label: string
  test: (v: string) => boolean
}

const RULES: StrengthRule[] = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "Uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "Lowercase letter", test: (v) => /[a-z]/.test(v) },
  { label: "Number", test: (v) => /\d/.test(v) },
  { label: "Special character (!@#$…)", test: (v) => /[^A-Za-z0-9]/.test(v) },
]

function strengthScore(password: string) {
  return RULES.filter((r) => r.test(password)).length
}

const STRENGTH_LABELS = ["", "Very weak", "Weak", "Fair", "Strong", "Very strong"]
const STRENGTH_COLORS = [
  "",
  "bg-destructive",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-emerald-500",
  "bg-emerald-600",
]

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z
  .object({
    new_password: z
      .string()
      .min(8, "Must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/\d/, "Must contain a number")
      .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
    confirm_password: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  })

type Values = z.infer<typeof schema>

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChangePasswordPage() {
  const router = useRouter()
  const { setAuthResult } = useAuth()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null)

  useEffect(() => {
    const token = sessionStorage.getItem("pre_auth_token")
    if (!token) {
      router.replace("/login")
    } else {
      setPreAuthToken(token)
    }
  }, [router])

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { new_password: "", confirm_password: "" },
  })

  const newPassword = form.watch("new_password")
  const score = strengthScore(newPassword)

  async function onSubmit(values: Values) {
    if (!preAuthToken) return
    setErrorMessage(null)
    try {
      const result = await apiChangePassword(preAuthToken, {
        new_password: values.new_password,
      })
      sessionStorage.removeItem("pre_auth_token")

      if (result.requires_totp) {
        // The API will have issued a new pre_auth_token for TOTP — but since
        // changePassword returns a new access token structure, redirect to 2FA.
        // In practice, the backend re-issues a pre_auth token via a new login.
        router.push("/2fa/verify")
      } else {
        router.push("/login")
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to change password.",
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>
          Your account requires a password change before you can continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {errorMessage && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            {/* New password */}
            <FormField
              control={form.control}
              name="new_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />

                  {/* Strength bar */}
                  {newPassword.length > 0 && (
                    <div className="space-y-2 mt-1">
                      <div className="flex gap-1">
                        {RULES.map((_, i) => (
                          <div
                            key={i}
                            className={cn(
                              "h-1 flex-1 rounded-full transition-all duration-300",
                              i < score
                                ? STRENGTH_COLORS[score]
                                : "bg-muted",
                            )}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {STRENGTH_LABELS[score]}
                      </p>

                      {/* Rule checklist */}
                      <ul className="space-y-1">
                        {RULES.map((rule) => {
                          const ok = rule.test(newPassword)
                          return (
                            <li
                              key={rule.label}
                              className={cn(
                                "flex items-center gap-1.5 text-xs",
                                ok
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-muted-foreground",
                              )}
                            >
                              {ok ? (
                                <CheckCircle2 className="size-3.5 shrink-0" />
                              ) : (
                                <XCircle className="size-3.5 shrink-0" />
                              )}
                              {rule.label}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </FormItem>
              )}
            />

            {/* Confirm password */}
            <FormField
              control={form.control}
              name="confirm_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full mt-2"
              size="lg"
              disabled={form.formState.isSubmitting || !preAuthToken}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Updating…
                </>
              ) : (
                "Set new password"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
