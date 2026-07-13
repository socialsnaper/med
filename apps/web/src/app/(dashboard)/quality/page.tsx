"use client"

import { useAuth } from "@/lib/auth/useAuth"
import { FlaskConical } from "lucide-react"

export default function QualityPage() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10">
          <FlaskConical className="size-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Quality Assurance
          </h1>
          <p className="text-sm text-muted-foreground">
            Batch record review, QA shop floor, and order release
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <p className="text-lg font-medium">
          Welcome,{" "}
          <span className="text-emerald-600">
            {user?.firstName ?? "Quality"}
          </span>
          .
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          You are signed in as <strong>{user?.role}</strong>.
        </p>
        <p className="text-sm text-muted-foreground mt-4 italic">
          Quality dashboard content coming soon.
        </p>
      </div>
    </div>
  )
}
