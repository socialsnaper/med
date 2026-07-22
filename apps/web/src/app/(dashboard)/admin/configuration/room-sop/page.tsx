"use client"

import Link from "next/link"
import { useAuth } from "@/lib/auth/useAuth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import {
  Home,
  ChevronLeft,
  Sparkles,
  FlaskConical,
  ClipboardCheck,
  ClipboardList,
  FolderOpen,
  Wrench,
} from "lucide-react"

// ── Room SOP sub-items ─────────────────────────────────────────────────────────

const ROOM_SOP_ITEMS = [
  {
    label: "Room Cleaning SOP",
    icon: Sparkles,
    href: "/admin/configuration/room-sop/room-cleaning-sop",
    color: "bg-sky-500/10 text-sky-600",
  },
  {
    label: "Room QAC",
    icon: FlaskConical,
    href: "/admin/configuration/room-sop/room-qac",
    color: "bg-violet-500/10 text-violet-600",
  },
  {
    label: "Inspection 1",
    icon: ClipboardCheck,
    href: "/admin/configuration/room-sop/inspection-1",
    color: "bg-emerald-500/10 text-emerald-600",
  },
  {
    label: "Inspection 2",
    icon: ClipboardList,
    href: "/admin/configuration/room-sop/inspection-2",
    color: "bg-orange-500/10 text-orange-600",
  },
  // { label: "SOP Files Maintainance", icon: FolderOpen, href: "/admin/configuration/room-sop/sop-files-maintainance", color: "bg-yellow-500/10 text-yellow-600" },
  // { label: "Preventive Maintaince", icon: Wrench, href: "/admin/configuration/room-sop/preventive-maintaince", color: "bg-rose-500/10 text-rose-600" },
]

// ── Page ───────────────────────────────────────────────────────────────────────

export default function RoomSopPage() {
  const { user } = useAuth()
  const router = useRouter()

  // Guard: only System Administrator and User Admin may access this page
  useEffect(() => {
    if (
      user &&
      user.role !== "System Administrator" &&
      user.role !== "User Admin"
    ) {
      router.replace("/admin")
    }
  }, [user, router])

  if (!user) return null

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="size-4 text-muted-foreground" />
        </button>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10">
          <Home className="size-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Room SOP</h1>
          <p className="text-sm text-muted-foreground">
            Room standard operating procedures and inspections
          </p>
        </div>
      </div>

      {/* ── Tiles grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {ROOM_SOP_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.label}
              href={item.href}
              className="group flex flex-col items-center gap-3 rounded-xl border bg-card p-5 text-center transition-all hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5"
            >
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-xl ${item.color} transition-transform group-hover:scale-110`}
              >
                <Icon className="size-6" />
              </div>
              <span className="text-xs font-medium leading-tight text-foreground">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
