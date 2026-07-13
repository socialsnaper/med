"use client"

import React, {
  createContext,
  useCallback,
  useEffect,
  useState,
} from "react"

import type { UserSummary } from "./api"
import { apiRefreshToken, apiLogout, setUnauthorizedHandler } from "./api"
import {
  setToken,
  getToken,
  clearToken,
  scheduleRefresh,
} from "./tokenManager"

// ── Context shape ─────────────────────────────────────────────────────────────

interface AuthContextValue {
  /** Authenticated user info, or null when logged out */
  user: UserSummary | null
  /** True while the initial silent refresh attempt is in progress */
  isLoading: boolean
  /** Call after a successful login or TOTP verify to initialise auth state */
  setAuthResult: (token: string, user: UserSummary) => void
  /** Clear auth state and call the logout endpoint */
  logout: () => Promise<void>
  /** Read the current in-memory access token */
  getAccessToken: () => string | null
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  setAuthResult: () => {},
  logout: async () => {},
  getAccessToken: () => null,
})

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ── Silent refresh callback ─────────────────────────────────────────────────

  const startRefreshCycle = useCallback(
    (token: string, currentUser: UserSummary) => {
      setToken(token)
      scheduleRefresh(
        async () => {
          const result = await apiRefreshToken()
          return result.access_token
        },
        (newToken) => {
          if (!newToken) {
            // Refresh failed — session ended
            setUser(null)
            clearToken()
          } else {
            setToken(newToken)
          }
        },
      )
      setUser(currentUser)
    },
    [],
  )

  // ── On mount: attempt silent re-auth via httpOnly refresh cookie ────────────

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const result = await apiRefreshToken()
        if (!cancelled) {
          // We got a new access token — but we don't have user info without a
          // /me endpoint. Decode the JWT payload (public, unsigned claims only).
          const payload = decodeJwtPayload(result.access_token)
          if (payload) {
            const restoredUser: UserSummary = {
              id:        payload.sub       as string ?? "",
              username:  payload.username  as string ?? "",
              firstName: payload.firstName as string ?? "",
              lastName:  payload.lastName  as string ?? "",
              role:      payload.roleName  as string ?? "",
            }
            startRefreshCycle(result.access_token, restoredUser)
          }
        }
      } catch {
        // No valid refresh cookie — user is not logged in
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [startRefreshCycle])

  // ── Global 401 handler ────────────────────────────────────────────────────
  // Register a callback so apiFetch can signal that a protected API returned
  // 401 (token expired, revoked, or account deactivated).  This immediately
  // clears auth state, causing ProtectedLayout to redirect to /login.

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      clearToken()
    })
    return () => {
      setUnauthorizedHandler(null)
    }
  }, [])

  // ── Public API ────────────────────────────────────────────────────────────

  const setAuthResult = useCallback(
    (token: string, newUser: UserSummary) => {
      startRefreshCycle(token, newUser)
    },
    [startRefreshCycle],
  )

  const logout = useCallback(async () => {
    const token = getToken()
    try {
      if (token) await apiLogout(token)
    } catch {
      // Ignore logout errors
    } finally {
      clearToken()
      setUser(null)
    }
  }, [])

  const getAccessToken = useCallback(() => getToken(), [])

  return (
    <AuthContext.Provider
      value={{ user, isLoading, setAuthResult, logout, getAccessToken }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ── JWT payload decoder (no verification — client-side only) ──────────────────

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".")
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(decoded)
  } catch {
    return null
  }
}
