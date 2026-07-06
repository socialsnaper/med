"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/useAuth"
import { getToken } from "@/lib/auth/tokenManager"
import { useEffect } from "react"

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  // Redirect to login if not authenticated (after initial load completes)
  // Check both user state AND in-memory token to handle race conditions
  useEffect(() => {
    if (!isLoading && !user && !getToken()) {
      router.push("/login")
    }
  }, [user, isLoading, router])

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Auth check failed — useEffect above will navigate to /login.
  // Render a visible redirecting state so the user never sees a blank page.
  const hasAuth = user || getToken()
  if (!hasAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Redirecting…</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
