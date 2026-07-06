/**
 * tokenManager.ts
 *
 * Module-level singleton that holds the access token in memory only.
 * Never written to localStorage or sessionStorage.
 *
 * Provides:
 *  - setToken / getToken / clearToken
 *  - scheduleRefresh — sets a 14-minute timer that silently fetches a new token
 *    using the httpOnly refresh cookie. Call this whenever a fresh token is stored.
 */

let _accessToken: string | null = null
let _refreshTimer: ReturnType<typeof setTimeout> | null = null

const REFRESH_INTERVAL_MS = 14 * 60 * 1000 // 14 minutes

export function setToken(token: string): void {
  _accessToken = token
}

export function getToken(): string | null {
  return _accessToken
}

export function clearToken(): void {
  _accessToken = null
  if (_refreshTimer !== null) {
    clearTimeout(_refreshTimer)
    _refreshTimer = null
  }
}

/**
 * Schedules a silent token refresh in 14 minutes.
 * The refreshFn should call POST /api/auth/refresh and return the new token.
 * If it succeeds, onRefreshed is called with the new token and a new timer is set.
 * Clears any previously scheduled timer before setting a new one.
 */
export function scheduleRefresh(
  refreshFn: () => Promise<string>,
  onRefreshed: (token: string) => void,
): void {
  if (_refreshTimer !== null) {
    clearTimeout(_refreshTimer)
  }
  _refreshTimer = setTimeout(async () => {
    try {
      const newToken = await refreshFn()
      setToken(newToken)
      onRefreshed(newToken)
      scheduleRefresh(refreshFn, onRefreshed)
    } catch {
      // Refresh failed — token expired; clear everything
      clearToken()
      onRefreshed("")
    }
  }, REFRESH_INTERVAL_MS)
}
