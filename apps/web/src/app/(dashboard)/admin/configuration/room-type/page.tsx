"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/useAuth"
import {
  apiListRoomTypes,
  apiDeleteRoomType,
  type RoomTypeItem,
  ApiError,
} from "@/lib/auth/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AddRoomTypeDialog } from "./AddRoomTypeDialog"
import { EditRoomTypeDialog } from "./EditRoomTypeDialog"
import {
  Building2,
  ChevronLeft,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Helpers ────────────────────────────────────────────────────────────────────

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
      <CheckCircle2 className="size-3" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
      <XCircle className="size-3" /> Inactive
    </span>
  )
}

// ── Delete confirmation ────────────────────────────────────────────────────────

function DeleteConfirm({
  item,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  item: RoomTypeItem
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <p className="text-sm font-medium text-destructive">
        Delete <span className="font-mono">{item.roomTypeId}</span> — {item.roomTypeName}?
      </p>
      <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" onClick={onConfirm} disabled={isDeleting}>
          {isDeleting && <Loader2 className="mr-1.5 size-3 animate-spin" />}
          Delete
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={isDeleting}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function RoomTypePage() {
  const { user, getAccessToken } = useAuth()
  const router = useRouter()

  const [items,       setItems]       = useState<RoomTypeItem[]>([])
  const [isLoading,   setIsLoading]   = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [search,      setSearch]      = useState("")
  const [addOpen,     setAddOpen]     = useState(false)
  const [editItem,    setEditItem]    = useState<RoomTypeItem | null>(null)
  const [deleteId,    setDeleteId]    = useState<string | null>(null)
  const [isDeleting,  setIsDeleting]  = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Role guard
  useEffect(() => {
    if (user && user.role !== "System Administrator" && user.role !== "User Admin") {
      router.replace("/admin")
    }
  }, [user, router])

  // Load / search
  const load = useCallback(
    async (q?: string) => {
      const token = getAccessToken()
      if (!token) return
      setIsLoading(true)
      setError(null)
      try {
        const data = await apiListRoomTypes(token, q)
        setItems(data)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load room types")
      } finally {
        setIsLoading(false)
      }
    },
    [getAccessToken],
  )

  useEffect(() => { load() }, [load])

  // Debounced search
  function handleSearch(value: string) {
    setSearch(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => load(value.trim() || undefined), 350)
  }

  // Delete
  async function handleDelete(id: string) {
    const token = getAccessToken()
    if (!token) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await apiDeleteRoomType(token, id)
      setItems((prev) => prev.filter((i) => i.id !== id))
      setDeleteId(null)
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setIsDeleting(false)
    }
  }

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
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10">
          <Building2 className="size-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Room Types</h1>
          <p className="text-sm text-muted-foreground">
            Manage room type master data for the facility
          </p>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by ID or name…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 size-4" />
          Add Room Type
        </Button>
      </div>

      {/* ── Delete error banner ── */}
      {deleteError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {deleteError}
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-destructive">
            <AlertCircle className="size-4" /> {error}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <Building2 className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search ? "No room types match your search." : "No room types added yet."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-28">ID</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Details</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground w-24 hidden sm:table-cell">Order</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground w-24">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <>
                  <tr
                    key={item.id}
                    className={cn(
                      "hover:bg-muted/30 transition-colors",
                      deleteId === item.id && "bg-destructive/5",
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.roomTypeId}</td>
                    <td className="px-4 py-3 font-medium">{item.roomTypeName}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {item.roomTypeDetails ?? <span className="text-muted-foreground/40 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums hidden sm:table-cell">{item.displayOrder}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge isActive={item.isActive} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          onClick={() => { setDeleteId(null); setEditItem(item) }}
                          title="Edit"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => { setDeleteId(deleteId === item.id ? null : item.id); setDeleteError(null) }}
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {deleteId === item.id && (
                    <tr key={`${item.id}-confirm`}>
                      <td colSpan={6} className="px-4 pb-3">
                        <DeleteConfirm
                          item={item}
                          onConfirm={() => handleDelete(item.id)}
                          onCancel={() => { setDeleteId(null); setDeleteError(null) }}
                          isDeleting={isDeleting}
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {!isLoading && !error && `${items.length} room type${items.length !== 1 ? "s" : ""}`}
      </p>

      {/* ── Dialogs ── */}
      <AddRoomTypeDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(newItem) => setItems((prev) => [...prev, newItem].sort((a, b) => a.displayOrder - b.displayOrder || a.roomTypeName.localeCompare(b.roomTypeName)))}
      />
      <EditRoomTypeDialog
        item={editItem}
        onClose={() => setEditItem(null)}
        onUpdated={(updated) => setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))}
      />
    </div>
  )
}
