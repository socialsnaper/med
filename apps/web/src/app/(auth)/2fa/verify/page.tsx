"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldCheck } from "lucide-react"
import { OTPInput, REGEXP_ONLY_DIGITS } from "input-otp"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { useAuth } from "@/lib/auth/useAuth"
import { apiVerifyTotp, apiRecoverWithBackupCode } from "@/lib/auth/api"
import { cn } from "@/lib/utils"

const TOTP_PERIOD = 30 // seconds

function useCountdown() {
  const [seconds, setSeconds] = useState(() => TOTP_PERIOD - (Math.floor(Date.now() / 1000) % TOTP_PERIOD))

  useEffect(() => {
    const tick = () => {
      setSeconds(TOTP_PERIOD - (Math.floor(Date.now() / 1000) % TOTP_PERIOD))
    }
    const interval = setInterval(tick, 500)
    return () => clearInterval(interval)
  }, [])

  return seconds
}

export default function TotpVerifyPage() {
  const router = useRouter()
  const { setAuthResult } = useAuth()

  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [backupCode, setBackupCode] = useState("")
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null)
  const countdown = useCountdown()
  const prevSecondsRef = useRef(countdown)

  // Load and validate pre_auth_token
  useEffect(() => {
    const token = sessionStorage.getItem("pre_auth_token")
    if (!token) {
      router.replace("/login")
    } else {
      setPreAuthToken(token)
    }
  }, [router])

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    if (otp.length === 6 && !loading) {
      handleVerify()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp])

  // Reset OTP when the TOTP window rolls over
  useEffect(() => {
    if (countdown === TOTP_PERIOD && prevSecondsRef.current === 1) {
      setOtp("")
      setErrorMessage(null)
    }
    prevSecondsRef.current = countdown
  }, [countdown])

  const handleVerify = useCallback(async () => {
    if (!preAuthToken) return
    setLoading(true)
    setErrorMessage(null)
    try {
      const result = await apiVerifyTotp(preAuthToken, otp)
      sessionStorage.removeItem("pre_auth_token")
      setAuthResult(result.access_token, result.user)
      router.push("/admin")
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Invalid code. Please try again.",
      )
      setOtp("")
    } finally {
      setLoading(false)
    }
  }, [preAuthToken, otp, setAuthResult, router])

  const handleBackupRecover = useCallback(async () => {
    if (!preAuthToken || backupCode.length < 8) return
    setLoading(true)
    setErrorMessage(null)
    try {
      const result = await apiRecoverWithBackupCode(preAuthToken, backupCode)
      sessionStorage.removeItem("pre_auth_token")
      setAuthResult(result.access_token, result.user)
      router.push("/admin")
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Invalid backup code.",
      )
    } finally {
      setLoading(false)
    }
  }, [preAuthToken, backupCode, setAuthResult, router])

  const circumference = 2 * Math.PI * 14
  const dashOffset = circumference * (1 - countdown / TOTP_PERIOD)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3 mb-1">
          {/* Step indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              Password
            </span>
            <span>→</span>
            <span className="font-semibold text-foreground">
              Authenticator code
            </span>
          </div>
        </div>
        <CardTitle>Two-factor authentication</CardTitle>
        <CardDescription>
          {useBackupCode
            ? "Enter one of your saved backup codes."
            : "Enter the 6-digit code from your authenticator app."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {!useBackupCode ? (
          <>
            {/* Countdown ring + OTP */}
            <div className="flex flex-col items-center gap-4">
              {/* Countdown timer */}
              <div className="relative flex items-center justify-center">
                <svg
                  className="size-10 -rotate-90"
                  viewBox="0 0 36 36"
                  aria-label={`${countdown} seconds remaining`}
                >
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    className={cn(
                      "transition-all duration-500",
                      countdown <= 5
                        ? "text-destructive"
                        : countdown <= 10
                          ? "text-orange-500"
                          : "text-primary",
                    )}
                  />
                </svg>
                <span className="absolute text-xs font-mono font-semibold tabular-nums">
                  {countdown}
                </span>
              </div>

              <OtpBoxes value={otp} onChange={setOtp} disabled={loading} />
            </div>

            <Button
              onClick={handleVerify}
              className="w-full"
              size="lg"
              disabled={otp.length !== 6 || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                "Verify"
              )}
            </Button>

            <button
              type="button"
              onClick={() => setUseBackupCode(true)}
              className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Use a backup code instead
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="backup-code">Backup code</Label>
              <Input
                id="backup-code"
                placeholder="xxxx-xxxx"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value.trim())}
                autoComplete="one-time-code"
              />
            </div>

            <Button
              onClick={handleBackupRecover}
              className="w-full"
              size="lg"
              disabled={backupCode.length < 8 || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                "Use backup code"
              )}
            </Button>

            <button
              type="button"
              onClick={() => {
                setUseBackupCode(false)
                setBackupCode("")
                setErrorMessage(null)
              }}
              className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Back to authenticator code
            </button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── 6-box OTP input ───────────────────────────────────────────────────────────

function OtpBoxes({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <OTPInput
      maxLength={6}
      value={value}
      onChange={onChange}
      pattern={REGEXP_ONLY_DIGITS}
      disabled={disabled}
      containerClassName="flex items-center gap-2"
      render={({ slots }) => (
        <>
          {slots.map((slot, i) => (
            <div
              key={i}
              className={cn(
                "relative flex h-12 w-10 items-center justify-center rounded-lg border text-lg font-mono transition-all",
                slot.isActive
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-input",
                disabled && "opacity-50",
              )}
            >
              {slot.char ?? (
                <span className="text-muted-foreground/30">0</span>
              )}
              {slot.hasFakeCaret && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-5 w-px animate-caret-blink bg-foreground" />
                </div>
              )}
            </div>
          ))}
        </>
      )}
    />
  )
}
