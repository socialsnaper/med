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
} from "lucide-react"

// ── Equ SOP sub-items ─────────────────────────────────────────────────────────

const EQU_SOP_ITEMS = [
  {
    label: "Eq Cleaning SOP",
    icon: Sparkles,
    href: "/admin/configuration/equ-sop/eq-cleaning-sop",
    color: "bg-sky-500/10 text-sky-600",
  },
  {
    label: "Equ QAC",
    icon: FlaskConical,
    href: "/admin/configuration/equ-sop/equ-qac",
    color: "bg-violet-500/10 text-violet-600",
  },
  {
    label: "Inspection 1",
    icon: ClipboardCheck,
    href: "/admin/configuration/equ-sop/inspection-1",
    color: "bg-emerald-500/10 text-emerald-600",
  },
  {
    label: "Inspection 2",
    icon: ClipboardList,
    href: "/admin/configuration/equ-sop/inspection-2",
    color: "bg-orange-500/10 text-orange-600",
  },
]

// ── Page ───────────────────────────────────────────────────────────────────────

export default function EquSopPage() {
  const { user } = useAuth()
  const router   = useRouter()

  useEffect(() => {
    if (user && user.role !== "System Administrator" && user.role !== "User Admin") {
      router.replace("/admin")
    }
  }, [user, router])

  if (!user) return null

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/configuration"
          className="flex items-center justify-center size-8 rounded-lg border hover:bg-accent transition-colors"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10">
          <Home className="size-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipment SOP</h1>
          <p className="text-sm text-muted-foreground">
            Equipment cleaning and inspection standard operating procedures
          </p>
        </div>
      </div>

      {/* ── Tiles grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {EQU_SOP_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.label}
              href={item.href}
              className="group flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center transition-all hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5"
            >
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-xl ${item.color} transition-transform group-hover:scale-110`}
              >
                <Icon className="size-6" />
              </div>
              <span className="text-sm font-medium leading-tight text-foreground">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
