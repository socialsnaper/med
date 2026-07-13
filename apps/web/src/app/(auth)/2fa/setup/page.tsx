"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Copy, Check } from "lucide-react"
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

import { useAuth } from "@/lib/auth/useAuth"
import { apiSetupTotp, apiVerifyTotpSetup } from "@/lib/auth/api"
import { cn } from "@/lib/utils"

export default function TotpSetupPage() {
  const router = useRouter()
  const { getAccessToken } = useAuth()

  const [qrCode, setQrCode] = useState<string | null>(null)
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null)
  const [showManualKey, setShowManualKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Load QR code on mount
  useEffect(() => {
    const token = getAccessToken()
    if (!token) {
      router.replace("/login")
      return
    }
    apiSetupTotp(token)
      .then(({ qr_code, otpauth_url }) => {
        setQrCode(qr_code)
        setOtpauthUrl(otpauth_url)
      })
      .catch((err) =>
        setErrorMessage(err instanceof Error ? err.message : "Failed to load setup"),
      )
      .finally(() => setLoading(false))
  }, [getAccessToken, router])

  // Extract secret from otpauth_url for manual entry
  const manualSecret = otpauthUrl
    ? new URLSearchParams(new URL(otpauthUrl).search).get("secret")
    : null

  const handleCopyKey = useCallback(() => {
    if (!manualSecret) return
    navigator.clipboard.writeText(manualSecret).then(() => {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    })
  }, [manualSecret])

  async function handleVerify() {
    if (otp.length !== 6) return
    const token = getAccessToken()
    if (!token) return

    setVerifying(true)
    setErrorMessage(null)
    try {
      const { backup_codes } = await apiVerifyTotpSetup(token, otp)
      // Store backup codes temporarily for the next screen
      sessionStorage.setItem("backup_codes", JSON.stringify(backup_codes))
      router.push("/2fa/backup-codes")
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Invalid code. Please try again.",
      )
      setOtp("")
    } finally {
      setVerifying(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up two-factor authentication</CardTitle>
        <CardDescription>
          Scan the QR code with your authenticator app (Google Authenticator,
          Authy, etc.), then enter the 6-digit code to confirm.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : qrCode ? (
          <>
            {/* QR code */}
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCode}
                alt="TOTP QR code"
                className="w-44 h-44 rounded-lg border bg-white p-1"
              />
              <button
                type="button"
                onClick={() => setShowManualKey((v) => !v)}
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                {showManualKey ? "Hide" : "Can't scan?"} manual entry key
              </button>

              {showManualKey && manualSecret && (
                <div className="w-full flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                  <code className="flex-1 text-xs font-mono break-all">
                    {manualSecret}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Copy secret key"
                  >
                    {copiedKey ? (
                      <Check className="size-4 text-emerald-600" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* OTP input */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-medium text-foreground">
                Enter the 6-digit code
              </p>
              <OtpBoxes value={otp} onChange={setOtp} />
            </div>

            <Button
              onClick={handleVerify}
              className="w-full"
              size="lg"
              disabled={otp.length !== 6 || verifying}
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                "Confirm and activate 2FA"
              )}
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ── 6-box OTP input ───────────────────────────────────────────────────────────

function OtpBoxes({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <OTPInput
      maxLength={6}
      value={value}
      onChange={onChange}
      pattern={REGEXP_ONLY_DIGITS}
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
