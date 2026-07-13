"use client"

import { useAuth } from "@/lib/auth/useAuth"
import { Shield } from "lucide-react"

export default function AdminPage() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
          <Shield className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Administration
          </h1>
          <p className="text-sm text-muted-foreground">
            User management, roles, and system configuration
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <p className="text-lg font-medium">
          Welcome,{" "}
          <span className="text-primary">
            {user?.firstName ?? "Administrator"}
          </span>
          .
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          You are signed in as <strong>{user?.role}</strong>.
        </p>
        <p className="text-sm text-muted-foreground mt-4 italic">
          Admin dashboard content coming soon.
        </p>
      </div>
    </div>
  )
}
