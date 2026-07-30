"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/lib/auth/useAuth"
import {
  apiListNotifications,
  apiGetUnreadNotificationCount,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
  ApiError,
  type NotificationItem,
} from "@/lib/auth/api"
import { Bell, BellRing, Check, CheckCheck, X } from "lucide-react"
import { cn } from "@/lib/utils"

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)  return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function NotificationBell() {
  const { getAccessToken } = useAuth()
  const [open,        setOpen]        = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading,     setLoading]     = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const fetchCount = useCallback(async () => {
    const token = getAccessToken()
    if (!token) return
    try {
      const { count } = await apiGetUnreadNotificationCount(token)
      setUnreadCount(count)
    } catch { /* silent */ }
  }, [getAccessToken])

  const fetchAll = useCallback(async () => {
    const token = getAccessToken()
    if (!token) return
    setLoading(true)
    try {
      const data = await apiListNotifications(token)
      setNotifications(data)
      setUnreadCount(data.filter((n) => !n.isRead).length)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [getAccessToken])

  // Poll for new notifications every 30s
  useEffect(() => {
    fetchCount()
    const id = setInterval(fetchCount, 30000)
    return () => clearInterval(id)
  }, [fetchCount])

  // Close panel on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  function handleOpen() {
    setOpen((o) => !o)
    if (!open) fetchAll()
  }

  async function handleMarkRead(id: string) {
    const token = getAccessToken(); if (!token) return
    try {
      await apiMarkNotificationRead(token, id)
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch { /* silent */ }
  }

  async function handleMarkAll() {
    const token = getAccessToken(); if (!token) return
    try {
      await apiMarkAllNotificationsRead(token)
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch { /* silent */ }
  }

  const BellIcon = unreadCount > 0 ? BellRing : Bell

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent transition-colors"
        aria-label="Notifications"
      >
        <BellIcon className={cn("size-4", unreadCount > 0 && "text-sky-600")} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold px-0.5">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border bg-background shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-sm">Notifications</span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-accent"
                  title="Mark all as read"
                >
                  <CheckCheck className="size-3.5" /> All read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent">
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto divide-y">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-1 text-muted-foreground">
                <Bell className="size-6 opacity-30" />
                <p className="text-xs">No notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/50",
                    !n.isRead && "bg-sky-50/60 dark:bg-sky-950/30",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium leading-snug", !n.isRead && "text-foreground")}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="shrink-0 mt-0.5 text-sky-600 hover:text-sky-800 transition-colors"
                      title="Mark as read"
                    >
                      <Check className="size-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
