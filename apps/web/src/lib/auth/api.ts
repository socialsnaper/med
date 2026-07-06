/**
 * api.ts — typed API client for the Digilog auth API.
 *
 * All requests go to NEXT_PUBLIC_API_URL (default: http://localhost:3001).
 * Requests that require authentication pass the Bearer token in the header.
 * Requests involving token refresh use `credentials: 'include'` so the
 * browser automatically sends the httpOnly refresh cookie.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

// ── Global 401 handler ────────────────────────────────────────────────────────
// AuthContext registers a callback here so that any 401 returned by a
// protected endpoint immediately clears in-memory auth state (e.g. when an
// admin deactivates the current user mid-session).

let _onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  _onUnauthorized = fn
}

// ── Error type ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// ── Base fetch helpers ────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, ...init } = options
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  const body = await res.json()
  if (!res.ok) {
    // A 401 on a protected route means the session is no longer valid
    // (token expired, revoked, or account deactivated). Clear auth state
    // immediately so ProtectedLayout redirects to /login on next render.
    if (res.status === 401 && _onUnauthorized) {
      _onUnauthorized()
    }
    throw new ApiError(
      body.error ?? "UNKNOWN",
      body.message ?? "An unexpected error occurred",
      res.status,
    )
  }
  return body.data as T
}

async function apiPost<T>(
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    token,
  })
}

async function apiGet<T>(path: string, token?: string | null): Promise<T> {
  return apiFetch<T>(path, { method: "GET", token })
}

// ── Response types ────────────────────────────────────────────────────────────

export interface UserSummary {
  id: string
  username: string
  firstName: string
  lastName: string
  role: string
}

export interface LoginSuccessResult {
  access_token: string
  user: UserSummary
  requires_totp: false
  requires_password_change: false
}

export interface LoginPreAuthResult {
  pre_auth_token: string
  requires_totp: boolean
  requires_password_change: boolean
}

export type LoginResult = LoginSuccessResult | LoginPreAuthResult

export interface TotpSetupResult {
  qr_code: string
  otpauth_url: string
}

export interface TotpSetupVerifyResult {
  backup_codes: string[]
}

export interface AuthTokensResult {
  access_token: string
  user: UserSummary
}

export interface RefreshResult {
  access_token: string
}

// ── Auth API calls ────────────────────────────────────────────────────────────

export function apiLogin(body: {
  company_code: string
  username: string
  password: string
}): Promise<LoginResult> {
  return apiPost<LoginResult>("/api/auth/login", body)
}

export function apiVerifyTotp(
  preAuthToken: string,
  code: string,
): Promise<AuthTokensResult> {
  return apiPost<AuthTokensResult>(
    "/api/auth/2fa/verify",
    { code },
    preAuthToken,
  )
}

export function apiRecoverWithBackupCode(
  preAuthToken: string,
  backup_code: string,
): Promise<AuthTokensResult> {
  return apiPost<AuthTokensResult>("/api/auth/2fa/recover", {
    pre_auth_token: preAuthToken,
    backup_code,
  })
}

export function apiSetupTotp(accessToken: string): Promise<TotpSetupResult> {
  return apiGet<TotpSetupResult>("/api/auth/2fa/setup", accessToken)
}

export function apiVerifyTotpSetup(
  accessToken: string,
  code: string,
): Promise<TotpSetupVerifyResult> {
  return apiPost<TotpSetupVerifyResult>(
    "/api/auth/2fa/setup/verify",
    { code },
    accessToken,
  )
}

export function apiRefreshToken(): Promise<RefreshResult> {
  return apiPost<RefreshResult>("/api/auth/refresh")
}

export function apiLogout(accessToken: string): Promise<void> {
  return apiPost<void>("/api/auth/logout", undefined, accessToken)
}

export function apiChangePassword(
  token: string,
  body: { new_password: string; current_password?: string },
): Promise<{ requires_totp: boolean }> {
  return apiPost<{ requires_totp: boolean }>(
    "/api/auth/password/change",
    body,
    token,
  )
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface UserListItem {
  id:                 string
  username:           string
  email:              string
  firstName:          string
  lastName:           string
  employeeCode:       string | null
  profilePicUrl:      string | null
  dateOfJoining:      string | null
  isActive:           boolean
  mustChangePassword: boolean
  totpEnabled:        boolean
  lastLoginAt:        string | null
  createdAt:          string
  updatedAt:          string
  role: {
    id:       string
    roleName: string
  }
}

export function apiGetUsers(accessToken: string): Promise<UserListItem[]> {
  return apiGet<UserListItem[]>("/api/users", accessToken)
}

export function apiGetUser(accessToken: string, userId: string): Promise<UserListItem> {
  return apiGet<UserListItem>(`/api/users/${userId}`, accessToken)
}

export interface CreateUserPayload {
  firstName:     string
  lastName:      string
  email:         string
  roleId:        string
  employeeCode?: string
  dateOfJoining?: string  // YYYY-MM-DD
}

export function apiCreateUser(
  accessToken: string,
  payload:     CreateUserPayload,
): Promise<UserListItem> {
  return apiPost<UserListItem>("/api/users", payload, accessToken)
}

export interface UpdateUserPayload {
  firstName?:     string
  lastName?:      string
  email?:         string
  roleId?:        string
  employeeCode?:  string | null
  dateOfJoining?: string | null  // YYYY-MM-DD or null to clear
}

export function apiUpdateUser(
  accessToken: string,
  userId:      string,
  payload:     UpdateUserPayload,
): Promise<UserListItem> {
  return apiFetch<UserListItem>(`/api/users/${userId}`, {
    method: "PATCH",
    body:   JSON.stringify(payload),
    token:  accessToken,
  })
}

export function apiSetUserStatus(
  accessToken: string,
  userId:      string,
  isActive:    boolean,
): Promise<UserListItem> {
  return apiFetch<UserListItem>(`/api/users/${userId}/status`, {
    method: "PATCH",
    body:   JSON.stringify({ is_active: isActive }),
    token:  accessToken,
  })
}

// ── Roles ─────────────────────────────────────────────────────────────────────

export interface RoleItem {
  id:        string
  roleName:  string
  roleGroup: string | null
  isActive:  boolean
}

export function apiGetRoles(accessToken: string): Promise<RoleItem[]> {
  return apiGet<RoleItem[]>("/api/roles", accessToken)
}

export async function apiExportUsers(accessToken: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/users/export`, {
    method:      "GET",
    credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    let code = "UNKNOWN", message = "Export failed"
    try { const b = await res.json(); code = b.error ?? code; message = b.message ?? message } catch { /* ignore */ }
    throw new ApiError(code, message, res.status)
  }
  return res.blob()
}

// ── Room Types ────────────────────────────────────────────────────────────────

export interface RoomTypeItem {
  id:              string
  roomTypeId:      string
  roomTypeName:    string
  roomTypeDetails: string | null
  displayOrder:    number
  isActive:        boolean
  createdAt:       string
  updatedAt:       string
}

export interface CreateRoomTypePayload {
  roomTypeName:    string
  roomTypeDetails?: string
  displayOrder?:   number
  isActive?:       boolean
}

export interface UpdateRoomTypePayload {
  roomTypeName?:    string
  roomTypeDetails?: string | null
  displayOrder?:    number
  isActive?:        boolean
}

export function apiListRoomTypes(
  accessToken: string,
  search?: string,
): Promise<RoomTypeItem[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ""
  return apiGet<RoomTypeItem[]>(`/api/room-types${qs}`, accessToken)
}

export function apiCreateRoomType(
  accessToken: string,
  payload:     CreateRoomTypePayload,
): Promise<RoomTypeItem> {
  return apiPost<RoomTypeItem>("/api/room-types", payload, accessToken)
}

export function apiUpdateRoomType(
  accessToken: string,
  id:          string,
  payload:     UpdateRoomTypePayload,
): Promise<RoomTypeItem> {
  return apiFetch<RoomTypeItem>(`/api/room-types/${id}`, {
    method: "PATCH",
    body:   JSON.stringify(payload),
    token:  accessToken,
  })
}

export function apiDeleteRoomType(
  accessToken: string,
  id:          string,
): Promise<null> {
  return apiFetch<null>(`/api/room-types/${id}`, {
    method: "DELETE",
    token:  accessToken,
  })
}
