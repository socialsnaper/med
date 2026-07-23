"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/useAuth"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Boxes,
  LogOut,
  ChevronDown,
  ChevronRight,
  Shield,
  Settings,
  Menu,
  X,
} from "lucide-react"
import { ProtectedLayout } from "./ProtectedLayout"
import { useState } from "react"
import { cn } from "@/lib/utils"

// ── Nav item types ─────────────────────────────────────────────────────────────

interface NavItem {
  label:    string
  href?:    string
  icon:     React.ElementType
  children?: { label: string; href: string }[]
  /** If set, only render when the condition is true */
  roles?:   string[]
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href:  "/admin",
    icon:  LayoutDashboard,
  },
  {
    label: "Administration",
    icon:  Shield,
    roles: ["System Administrator", "User Admin"],
    children: [
      { label: "Users", href: "/admin/users" },
    ],
  },
  {
    label: "Configuration",
    href:  "/admin/configuration",
    icon:  Settings,
    roles: ["System Administrator", "User Admin"],
  },
  {
    label: "Operations",
    href:  "/operations",
    icon:  Boxes,
  },
  {
    label: "Quality",
    href:  "/quality",
    icon:  ClipboardCheck,
  },
]

// ── Sidebar ────────────────────────────────────────────────────────────────────

function Sidebar({ userRole, onNavigate }: { userRole?: string; onNavigate?: () => void }) {
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<string[]>(["Administration"])

  function toggleGroup(label: string) {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    )
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (userRole && item.roles.includes(userRole)),
  )

  return (
    <nav className="flex flex-col gap-1 py-4 px-2">
      {visibleItems.map((item) => {
        if (item.children) {
          const isOpen = openGroups.includes(item.label)
          const isGroupActive = item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"))

          return (
            <div key={item.label}>
              <button
                onClick={() => toggleGroup(item.label)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isGroupActive
                    ? "text-foreground bg-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {isOpen ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
              </button>

              {isOpen && (
                <div className="ml-6 mt-1 flex flex-col gap-1">
                  {item.children.map((child) => {
                    const isActive = pathname === child.href || pathname.startsWith(child.href + "/")
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                          isActive
                            ? "font-medium text-foreground bg-accent"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                        )}
                      >
                        <Users className="size-3.5 shrink-0" />
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        }

        const isActive = item.href
          ? pathname === item.href || pathname.startsWith(item.href + "/")
          : false

        return (
          <Link
            key={item.label}
            href={item.href!}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "text-foreground bg-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

// ── Layout ─────────────────────────────────────────────────────────────────────

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  async function handleLogout() {
    await logout()
    router.push("/login")
  }

  return (
    <ProtectedLayout>
      <div className="min-h-screen flex flex-col bg-background">
        {/* ── Top header ──────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              {/* Hamburger — mobile only */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileNavOpen((o) => !o)}
                aria-label="Toggle menu"
              >
                {mobileNavOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              </Button>
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                D
              </div>
              <span className="font-semibold text-sm">Digilog</span>
            </div>

            <div className="flex items-center gap-3">
              {user && (
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium leading-none">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{user.role}</p>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                aria-label="Log out"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* ── Body: sidebar + content ──────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Mobile nav overlay */}
          {mobileNavOpen && (
            <div
              className="fixed inset-0 z-30 md:hidden"
              onClick={() => setMobileNavOpen(false)}
            >
              <div className="absolute inset-0 bg-black/40" />
              <aside
                className="absolute left-0 top-0 h-full w-64 bg-background border-r shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <Sidebar userRole={user?.role} onNavigate={() => setMobileNavOpen(false)} />
              </aside>
            </div>
          )}

          {/* Desktop sidebar */}
          <aside className="hidden md:flex w-56 shrink-0 flex-col border-r bg-background">
            <Sidebar userRole={user?.role} />
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto px-4 sm:px-8 py-8">
            {children}
          </main>
        </div>
      </div>
    </ProtectedLayout>
  )
}
