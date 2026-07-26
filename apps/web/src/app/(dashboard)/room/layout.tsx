"use client"

import { DoorOpen } from "lucide-react"

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-500/10">
          <DoorOpen className="size-5 text-sky-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Room</h1>
          <p className="text-sm text-muted-foreground">
            Room management — maintenance and cleaning operations
          </p>
        </div>
      </div>

      {children}
    </div>
  )
}
