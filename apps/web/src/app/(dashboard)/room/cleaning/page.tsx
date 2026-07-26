"use client"

import { Sparkles } from "lucide-react"

export default function RoomCleaningPage() {
  return (
    <div className="rounded-xl border bg-card p-10 flex flex-col items-center gap-3 text-center">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10">
        <Sparkles className="size-6 text-emerald-600" />
      </div>
      <h2 className="text-lg font-semibold">Room Cleaning</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Room cleaning records, SOP execution, and handover logs will appear here.
      </p>
    </div>
  )
}
