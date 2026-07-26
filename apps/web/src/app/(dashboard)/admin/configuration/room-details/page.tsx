"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/useAuth"
import {
  apiListRooms,
  apiListRoomTypes,
  apiDeleteRoom,
  type RoomItem,
  type RoomTypeItem,
  ApiError,
} from "@/lib/auth/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AddRoomDialog } from "./AddRoomDialog"
import { EditRoomDialog } from "./EditRoomDialog"
import {
  DoorOpen,
  ChevronLeft,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  X,
  Wrench,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active:            { label: "Active",            className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  under_maintenance: { label: "Maintenance",        className: "bg-red-50 text-red-700 ring-red-200" },
  under_cleaning:    { label: "Cleaning",           className: "bg-sky-50 text-sky-700 ring-sky-200" },
  quarantined:       { label: "Quarantined",        className: "bg-amber-50 text-amber-700 ring-amber-200" },
  decommissioned:    { label: "Decommissioned",     className: "bg-slate-100 text-slate-500 ring-slate-200" },
}

function StatusBadge({ status, isActive }: { status: string; isActive: boolean }) {
  if (!isActive) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
        <XCircle className="size-3" /> Inactive
      </span>
    )
  }
  const cfg = STATUS_LABELS[status] ?? STATUS_LABELS.active
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1", cfg.className)}>
      {status === "active" ? <CheckCircle2 className="size-3" /> : <Wrench className="size-3" />}
      {cfg.label}
    </span>
  )
}

// ── Delete dialog ──────────────────────────────────────────────────────────────

function DeleteDialog({
  item, onConfirm, onCancel, isDeleting, error,
}: {
  item:       RoomItem | null
  onConfirm:  () => void
  onCancel:   () => void
  isDeleting: boolean
  error:      string | null
}) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-4" /> Delete Room
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-mono font-semibold">{item?.roomId}</span>{" "}
            — {item?.roomName}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm" onClick={onCancel} disabled={isDeleting}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting && <Loader2 className="mr-1.5 size-3 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function RoomDetailsPage() {
  const { user, getAccessToken } = useAuth()
  const router = useRouter()

  const [items,       setItems]       = useState<RoomItem[]>([])
  const [roomTypes,   setRoomTypes]   = useState<RoomTypeItem[]>([])
  const [isLoading,   setIsLoading]   = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [search,      setSearch]      = useState("")
  const [addOpen,     setAddOpen]     = useState(false)
  const [editItem,    setEditItem]    = useState<RoomItem | null>(null)
  const [deleteId,    setDeleteId]    = useState<string | null>(null)
  const [isDeleting,  setIsDeleting]  = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (user && user.role !== "System Administrator" && user.role !== "User Admin") {
      router.replace("/admin")
    }
  }, [user, router])

  const load = useCallback(
    async (q?: string) => {
      const token = getAccessToken()
      if (!token) return
      setIsLoading(true)
      setError(null)
      try {
        const [roomsData, typesData] = await Promise.all([
          apiListRooms(token, q, false),   // activeOnly=false to show all rooms
          apiListRoomTypes(token),
        ])
        setItems(roomsData)
        setRoomTypes(typesData)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load rooms")
      } finally {
        setIsLoading(false)
      }
    },
    [getAccessToken],
  )

  useEffect(() => { load() }, [load])

  function handleSearch(value: string) {
    setSearch(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => load(value.trim() || undefined), 350)
  }

  async function handleDelete(id: string) {
    const token = getAccessToken()
    if (!token) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await apiDeleteRoom(token, id)
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
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10">
          <DoorOpen className="size-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Room Details</h1>
          <p className="text-sm text-muted-foreground">
            Manage facility rooms — assign room types, floor, and building
          </p>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by ID, name, floor…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <div className="ml-auto">
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 size-4" /> Add Room
          </Button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
          <button className="ml-auto" onClick={() => setError(null)}><X className="size-4" /></button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Loading rooms…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-destructive">
            <AlertCircle className="size-6" />
            <p className="text-sm font-medium">{error}</p>
            <Button variant="outline" size="sm" onClick={() => load()}>Retry</Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
            <DoorOpen className="size-8 opacity-30" />
            <p className="text-sm">No rooms found. Click "Add Room" to create one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Room ID</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Room Name</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Room Type</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Floor</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Building</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((room) => (
                  <tr key={room.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{room.roomId}</td>
                    <td className="px-4 py-3 font-medium">{room.roomName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {room.roomTypeName ?? <span className="italic text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {room.floor ?? <span className="italic text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {room.building ?? <span className="italic text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={room.status} isActive={room.isActive} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => setEditItem(room)}
                          title="Edit"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => { setDeleteId(room.id); setDeleteError(null) }}
                          title="Delete"
                          disabled={room.status !== "active"}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}
      <AddRoomDialog
        open={addOpen}
        roomTypes={roomTypes}
        onClose={() => setAddOpen(false)}
        onCreated={(item) => { setItems((prev) => [...prev, item]); setAddOpen(false) }}
      />
      <EditRoomDialog
        item={editItem}
        roomTypes={roomTypes}
        onClose={() => setEditItem(null)}
        onUpdated={(updated) => {
          setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i))
          setEditItem(null)
        }}
      />
      <DeleteDialog
        item={deleteId ? (items.find((i) => i.id === deleteId) ?? null) : null}
        onConfirm={() => { if (deleteId) handleDelete(deleteId) }}
        onCancel={() => { setDeleteId(null); setDeleteError(null) }}
        isDeleting={isDeleting}
        error={deleteError}
      />
    </div>
  )
}
