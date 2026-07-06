"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Download, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function BackupCodesPage() {
  const router = useRouter()
  const [codes, setCodes] = useState<string[]>([])
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem("backup_codes")
    if (!raw) {
      router.replace("/login")
      return
    }
    try {
      const parsed = JSON.parse(raw) as string[]
      setCodes(parsed)
    } catch {
      router.replace("/login")
    }
  }, [router])

  const handleDownload = useCallback(() => {
    const text = [
      "Digilog — Two-Factor Backup Codes",
      "Keep these codes in a safe place.",
      "Each code can only be used once.",
      "",
      ...codes,
    ].join("\n")
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "digilog-backup-codes.txt"
    a.click()
    URL.revokeObjectURL(url)
  }, [codes])

  const handleDone = useCallback(() => {
    sessionStorage.removeItem("backup_codes")
    router.push("/admin")
  }, [router])

  if (codes.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Save your backup codes</CardTitle>
        <CardDescription>
          Two-factor authentication is now active. Save these 8 codes — each
          can be used once if you lose access to your authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Alert>
          <AlertDescription>
            Store these codes somewhere safe, like a password manager. They{" "}
            <strong>cannot be retrieved</strong> after you leave this page.
          </AlertDescription>
        </Alert>

        {/* Code grid */}
        <div className="grid grid-cols-2 gap-2">
          {codes.map((code) => (
            <div
              key={code}
              className="flex items-center justify-center rounded-lg border bg-muted/50 px-3 py-2.5 font-mono text-sm tracking-widest select-all"
            >
              {code}
            </div>
          ))}
        </div>

        {/* Download */}
        <Button variant="outline" onClick={handleDownload} className="w-full">
          <Download className="mr-2 size-4" />
          Download as .txt
        </Button>

        {/* Confirmation checkbox */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded accent-primary"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span className="text-sm text-muted-foreground leading-snug">
            I have saved my backup codes in a secure location.
          </span>
        </label>

        <Button
          onClick={handleDone}
          className="w-full"
          size="lg"
          disabled={!confirmed}
        >
          <ShieldCheck className="mr-2 size-4" />
          Continue to dashboard
        </Button>
      </CardContent>
    </Card>
  )
}
