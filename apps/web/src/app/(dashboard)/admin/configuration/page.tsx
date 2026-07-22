"use client"

import Link from "next/link"
import { useAuth } from "@/lib/auth/useAuth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import {
  Building2,
  GitBranch,
  Package,
  Code2,
  Box,
  Layers,
  FileText,
  ClipboardList,
  Wrench,
  Scale,
  Gauge,
  Sparkles,
  Droplets,
  Home,
  Settings2,
  Cpu,
  Building,
  BadgeCheck,
  Settings,
} from "lucide-react"

// ── Configuration items ────────────────────────────────────────────────────────

const CONFIG_ITEMS = [
  {
    label: "Room Type",
    icon: Building2,
    href: "/admin/configuration/room-type",
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    label: "Process Type",
    icon: GitBranch,
    href: "/admin/configuration/process-type",
    color: "bg-purple-500/10 text-purple-600",
  },
  {
    label: "Packing Type",
    icon: Package,
    href: "/admin/configuration/packing-type",
    color: "bg-orange-500/10 text-orange-600",
  },
  {
    label: "Function",
    icon: Code2,
    href: "/admin/configuration/function",
    color: "bg-cyan-500/10 text-cyan-600",
  },
  // { label: "Product", icon: Box, href: "/admin/configuration/product", color: "bg-green-500/10 text-green-600" },
  // { label: "Process Batch", icon: Layers, href: "/admin/configuration/process-batch", color: "bg-indigo-500/10 text-indigo-600" },
  // { label: "SOP Files", icon: FileText, href: "/admin/configuration/sop-files", color: "bg-yellow-500/10 text-yellow-600" },
  // { label: "Forms", icon: ClipboardList, href: "/admin/configuration/forms", color: "bg-pink-500/10 text-pink-600" },
  // { label: "Tools", icon: Wrench, href: "/admin/configuration/tools", color: "bg-stone-500/10 text-stone-600" },
  {
    label: "Weight",
    icon: Scale,
    href: "/admin/configuration/weight",
    color: "bg-teal-500/10 text-teal-600",
  },
  {
    label: "Scale",
    icon: Gauge,
    href: "/admin/configuration/scale",
    color: "bg-violet-500/10 text-violet-600",
  },
  {
    label: "Cleaning Equipment",
    icon: Sparkles,
    href: "/admin/configuration/cleaning-equipment",
    color: "bg-sky-500/10 text-sky-600",
  },
  {
    label: "Cleaning Type",
    icon: Droplets,
    href: "/admin/configuration/cleaning-type",
    color: "bg-teal-400/10 text-teal-600",
  },
  {
    label: "Cleaning Aids",
    icon: Droplets,
    href: "/admin/configuration/cleaning-aids",
    color: "bg-blue-400/10 text-blue-500",
  },
  {
    label: "Room SOP",
    icon: Home,
    href: "/admin/configuration/room-sop",
    color: "bg-emerald-500/10 text-emerald-600",
  },
  {
    label: "Equ SOP",
    icon: Settings2,
    href: "/admin/configuration/equ-sop",
    color: "bg-violet-500/10 text-violet-600",
  },
  {
    label: "Eqp Details",
    icon: Cpu,
    href: "/admin/configuration/eqp-details",
    color: "bg-rose-500/10 text-rose-600",
  },
  // { label: "Room Details", icon: Building, href: "/admin/configuration/room-details", color: "bg-amber-500/10 text-amber-600" },
  {
    label: "SOP Approval",
    icon: BadgeCheck,
    href: "/admin/configuration/sop-approval",
    color: "bg-lime-500/10 text-lime-600",
  },
]

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ConfigurationPage() {
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
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
          <Settings className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Configuration
          </h1>
          <p className="text-sm text-muted-foreground">
            One-time system configuration options
          </p>
        </div>
      </div>

      {/* ── Tiles grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {CONFIG_ITEMS.map((item) => {
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
