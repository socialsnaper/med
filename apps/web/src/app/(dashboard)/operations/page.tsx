"use client"

import { useAuth } from "@/lib/auth/useAuth"
import { Factory } from "lucide-react"

export default function OperationsPage() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-500/10">
          <Factory className="size-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Operations
          </h1>
          <p className="text-sm text-muted-foreground">
            Shop floor, batch records, rooms, and equipment
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <p className="text-lg font-medium">
          Welcome,{" "}
          <span className="text-orange-600">
            {user?.firstName ?? "Operator"}
          </span>
          .
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          You are signed in as <strong>{user?.role}</strong>.
        </p>
        <p className="text-sm text-muted-foreground mt-4 italic">
          Operations dashboard content coming soon.
        </p>
      </div>
    </div>
  )
}
