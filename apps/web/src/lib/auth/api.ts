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

export async function apiExportRoomTypes(accessToken: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/room-types/export`, {
    method: "GET", credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    let code = "UNKNOWN", message = "Export failed"
    try { const b = await res.json(); code = b.error ?? code; message = b.message ?? message } catch { /* */ }
    throw new ApiError(code, message, res.status)
  }
  return res.blob()
}

export interface RoomTypeImportRow {
  roomTypeName:    string
  roomTypeDetails?: string
  displayOrder?:   number
}

export interface ImportResult {
  created: number
  skipped: number
  errors:  { row: number; message: string }[]
}

export function apiImportRoomTypes(
  accessToken: string,
  rows: RoomTypeImportRow[],
): Promise<ImportResult> {
  return apiPost<ImportResult>("/api/room-types/import", { rows }, accessToken)
}

// ── Process Types ─────────────────────────────────────────────────────────────

export interface ProcessTypeItem {
  id:                 string
  processId:          string
  processType:        string
  processDetails:     string | null
  processGroup:       string | null
  typicalDurationMin: number | null
  requiresCleanRoom:  boolean
  displayOrder:       number
  isActive:           boolean
  createdAt:          string
  updatedAt:          string
}

export interface CreateProcessTypePayload {
  processType:         string
  processDetails?:     string
  processGroup?:       string
  typicalDurationMin?: number | null
  requiresCleanRoom?:  boolean
  displayOrder?:       number
  isActive?:           boolean
}

export interface UpdateProcessTypePayload {
  processType?:        string
  processDetails?:     string | null
  processGroup?:       string | null
  typicalDurationMin?: number | null
  requiresCleanRoom?:  boolean
  displayOrder?:       number
  isActive?:           boolean
}

export function apiListProcessTypes(
  accessToken: string,
  search?: string,
  group?: string,
): Promise<ProcessTypeItem[]> {
  const params = new URLSearchParams()
  if (search) params.set("search", search)
  if (group)  params.set("group",  group)
  const qs = params.toString() ? `?${params.toString()}` : ""
  return apiGet<ProcessTypeItem[]>(`/api/process-types${qs}`, accessToken)
}

export function apiListProcessGroups(accessToken: string): Promise<string[]> {
  return apiGet<string[]>("/api/process-types/groups", accessToken)
}

export function apiCreateProcessType(
  accessToken: string,
  payload:     CreateProcessTypePayload,
): Promise<ProcessTypeItem> {
  return apiPost<ProcessTypeItem>("/api/process-types", payload, accessToken)
}

export function apiUpdateProcessType(
  accessToken: string,
  id:          string,
  payload:     UpdateProcessTypePayload,
): Promise<ProcessTypeItem> {
  return apiFetch<ProcessTypeItem>(`/api/process-types/${id}`, {
    method: "PATCH",
    body:   JSON.stringify(payload),
    token:  accessToken,
  })
}

export function apiDeleteProcessType(
  accessToken: string,
  id:          string,
): Promise<null> {
  return apiFetch<null>(`/api/process-types/${id}`, {
    method: "DELETE",
    token:  accessToken,
  })
}

export async function apiExportProcessTypes(accessToken: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/process-types/export`, {
    method: "GET", credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    let code = "UNKNOWN", message = "Export failed"
    try { const b = await res.json(); code = b.error ?? code; message = b.message ?? message } catch { /* */ }
    throw new ApiError(code, message, res.status)
  }
  return res.blob()
}

export interface ProcessTypeImportRow {
  processType:         string
  processDetails?:     string
  processGroup?:       string
  typicalDurationMin?: number | null
  requiresCleanRoom?:  boolean | string
  displayOrder?:       number
}

export function apiImportProcessTypes(
  accessToken: string,
  rows: ProcessTypeImportRow[],
): Promise<ImportResult> {
  return apiPost<ImportResult>("/api/process-types/import", { rows }, accessToken)
}

// ── Cleaning Equipment ────────────────────────────────────────────────────────

export const CLEANING_TYPES = ['dry', 'wet', 'sanitizing', 'general'] as const
export type CleaningType = typeof CLEANING_TYPES[number]

export interface CleaningEquipmentItem {
  id:                      string
  equipmentCode:           string
  equipmentName:           string
  equipmentDetails:        string | null
  cleaningType:            CleaningType
  material:                string | null
  requiresReplacement:     boolean
  replacementIntervalDays: number | null
  displayOrder:            number
  isActive:                boolean
  createdAt:               string
  updatedAt:               string
}

export interface CreateCleaningEquipmentPayload {
  equipmentName:            string
  equipmentDetails?:        string
  cleaningType?:            CleaningType
  material?:                string
  requiresReplacement?:     boolean
  replacementIntervalDays?: number | null
  displayOrder?:            number
  isActive?:                boolean
}

export interface UpdateCleaningEquipmentPayload {
  equipmentName?:           string
  equipmentDetails?:        string | null
  cleaningType?:            CleaningType
  material?:                string | null
  requiresReplacement?:     boolean
  replacementIntervalDays?: number | null
  displayOrder?:            number
  isActive?:                boolean
}

export interface ImportRow {
  equipmentName:            string
  equipmentDetails?:        string
  cleaningType?:            CleaningType
  material?:                string
  requiresReplacement?:     boolean | string
  replacementIntervalDays?: number | null
  displayOrder?:            number
}

export interface ImportResult {
  created: number
  skipped: number
  errors:  { row: number; message: string }[]
}

export function apiListCleaningEquipment(
  accessToken: string,
  search?: string,
  type?: string,
): Promise<CleaningEquipmentItem[]> {
  const params = new URLSearchParams()
  if (search) params.set("search", search)
  if (type)   params.set("type",   type)
  const qs = params.toString() ? `?${params.toString()}` : ""
  return apiGet<CleaningEquipmentItem[]>(`/api/cleaning-equipment${qs}`, accessToken)
}

export function apiCreateCleaningEquipment(
  accessToken: string,
  payload:     CreateCleaningEquipmentPayload,
): Promise<CleaningEquipmentItem> {
  return apiPost<CleaningEquipmentItem>("/api/cleaning-equipment", payload, accessToken)
}

export function apiUpdateCleaningEquipment(
  accessToken: string,
  id:          string,
  payload:     UpdateCleaningEquipmentPayload,
): Promise<CleaningEquipmentItem> {
  return apiFetch<CleaningEquipmentItem>(`/api/cleaning-equipment/${id}`, {
    method: "PATCH",
    body:   JSON.stringify(payload),
    token:  accessToken,
  })
}

export function apiDeleteCleaningEquipment(
  accessToken: string,
  id:          string,
): Promise<null> {
  return apiFetch<null>(`/api/cleaning-equipment/${id}`, {
    method: "DELETE",
    token:  accessToken,
  })
}

export async function apiExportCleaningEquipment(accessToken: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/cleaning-equipment/export`, {
    method:      "GET",
    credentials: "include",
    headers:     { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    let code = "UNKNOWN", message = "Export failed"
    try { const b = await res.json(); code = b.error ?? code; message = b.message ?? message } catch { /* */ }
    throw new ApiError(code, message, res.status)
  }
  return res.blob()
}

export function apiImportCleaningEquipment(
  accessToken: string,
  rows:        ImportRow[],
): Promise<ImportResult> {
  return apiPost<ImportResult>("/api/cleaning-equipment/import", { rows }, accessToken)
}

// ── Packaging Types ───────────────────────────────────────────────────────────

export const PACKAGING_CATEGORIES = [
  'blister', 'bottle', 'sachet', 'strip', 'vial', 'ampoule', 'tube', 'pouch', 'other',
] as const
export type PackagingCategory = typeof PACKAGING_CATEGORIES[number]

export interface PackagingTypeItem {
  id:                   string
  packagingTypeId:      string
  packagingTypeName:    string
  packagingTypeDetails: string | null
  packagingCategory:    PackagingCategory | null
  primaryMaterial:      string | null
  packUnit:             string | null
  standardPackSize:     number | null
  storageConditions:    string | null
  displayOrder:         number
  isActive:             boolean
  createdAt:            string
  updatedAt:            string
}

export interface CreatePackagingTypePayload {
  packagingTypeName:    string
  packagingTypeDetails?: string
  packagingCategory?:   PackagingCategory
  primaryMaterial?:     string
  packUnit?:            string
  standardPackSize?:    number
  storageConditions?:   string
  displayOrder?:        number
  isActive?:            boolean
}

export interface UpdatePackagingTypePayload {
  packagingTypeName?:    string
  packagingTypeDetails?: string | null
  packagingCategory?:    PackagingCategory | null
  primaryMaterial?:      string | null
  packUnit?:             string | null
  standardPackSize?:     number | null
  storageConditions?:    string | null
  displayOrder?:         number
  isActive?:             boolean
}

export interface PackagingTypeImportRow {
  packagingTypeName:    string
  packagingTypeDetails?: string
  packagingCategory?:   PackagingCategory
  primaryMaterial?:     string
  packUnit?:            string
  standardPackSize?:    number
  storageConditions?:   string
  displayOrder?:        number
}

export function apiListPackagingTypes(
  accessToken: string,
  search?: string,
  category?: string,
): Promise<PackagingTypeItem[]> {
  const params = new URLSearchParams()
  if (search)   params.set("search",   search)
  if (category) params.set("category", category)
  const qs = params.toString() ? `?${params.toString()}` : ""
  return apiGet<PackagingTypeItem[]>(`/api/packaging-types${qs}`, accessToken)
}

export function apiCreatePackagingType(
  accessToken: string,
  payload:     CreatePackagingTypePayload,
): Promise<PackagingTypeItem> {
  return apiPost<PackagingTypeItem>("/api/packaging-types", payload, accessToken)
}

export function apiUpdatePackagingType(
  accessToken: string,
  id:          string,
  payload:     UpdatePackagingTypePayload,
): Promise<PackagingTypeItem> {
  return apiFetch<PackagingTypeItem>(`/api/packaging-types/${id}`, {
    method: "PATCH",
    body:   JSON.stringify(payload),
    token:  accessToken,
  })
}

export function apiDeletePackagingType(
  accessToken: string,
  id:          string,
): Promise<null> {
  return apiFetch<null>(`/api/packaging-types/${id}`, {
    method: "DELETE",
    token:  accessToken,
  })
}

export async function apiExportPackagingTypes(accessToken: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/packaging-types/export`, {
    method: "GET", credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    let code = "UNKNOWN", message = "Export failed"
    try { const b = await res.json(); code = b.error ?? code; message = b.message ?? message } catch { /* */ }
    throw new ApiError(code, message, res.status)
  }
  return res.blob()
}

export function apiImportPackagingTypes(
  accessToken: string,
  rows:        PackagingTypeImportRow[],
): Promise<ImportResult> {
  return apiPost<ImportResult>("/api/packaging-types/import", { rows }, accessToken)
}

// ── Function Types ────────────────────────────────────────────────────────────

export interface FunctionTypeItem {
  id:                    string
  functionTypeId:        string
  functionTypeName:      string
  functionTypeDetails:   string | null
  canSignOff:            boolean
  canOperateBatch:       boolean
  canPerformCleaning:    boolean
  canPerformMaintenance: boolean
  displayOrder:          number
  isActive:              boolean
  createdAt:             string
  updatedAt:             string
}

export interface CreateFunctionTypePayload {
  functionTypeName:      string
  functionTypeDetails?:  string
  canSignOff?:           boolean
  canOperateBatch?:      boolean
  canPerformCleaning?:   boolean
  canPerformMaintenance?: boolean
  displayOrder?:         number
  isActive?:             boolean
}

export interface UpdateFunctionTypePayload {
  functionTypeName?:      string
  functionTypeDetails?:   string | null
  canSignOff?:            boolean
  canOperateBatch?:       boolean
  canPerformCleaning?:    boolean
  canPerformMaintenance?: boolean
  displayOrder?:          number
  isActive?:              boolean
}

export interface FunctionTypeImportRow {
  functionTypeName:      string
  functionTypeDetails?:  string
  canSignOff?:           boolean | string
  canOperateBatch?:      boolean | string
  canPerformCleaning?:   boolean | string
  canPerformMaintenance?: boolean | string
  displayOrder?:         number
}

export function apiListFunctionTypes(
  accessToken: string,
  search?: string,
): Promise<FunctionTypeItem[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ""
  return apiGet<FunctionTypeItem[]>(`/api/function-types${qs}`, accessToken)
}

export function apiCreateFunctionType(
  accessToken: string,
  payload:     CreateFunctionTypePayload,
): Promise<FunctionTypeItem> {
  return apiPost<FunctionTypeItem>("/api/function-types", payload, accessToken)
}

export function apiUpdateFunctionType(
  accessToken: string,
  id:          string,
  payload:     UpdateFunctionTypePayload,
): Promise<FunctionTypeItem> {
  return apiFetch<FunctionTypeItem>(`/api/function-types/${id}`, {
    method: "PATCH",
    body:   JSON.stringify(payload),
    token:  accessToken,
  })
}

export function apiDeleteFunctionType(
  accessToken: string,
  id:          string,
): Promise<null> {
  return apiFetch<null>(`/api/function-types/${id}`, {
    method: "DELETE",
    token:  accessToken,
  })
}

export async function apiExportFunctionTypes(accessToken: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/function-types/export`, {
    method: "GET", credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    let code = "UNKNOWN", message = "Export failed"
    try { const b = await res.json(); code = b.error ?? code; message = b.message ?? message } catch { /* */ }
    throw new ApiError(code, message, res.status)
  }
  return res.blob()
}

export function apiImportFunctionTypes(
  accessToken: string,
  rows:        FunctionTypeImportRow[],
): Promise<ImportResult> {
  return apiPost<ImportResult>("/api/function-types/import", { rows }, accessToken)
}

// ── Scales ────────────────────────────────────────────────────────────────────

export const SCALE_TYPES    = ["analytical", "precision", "industrial", "moisture", "other"] as const
export const SCALE_STATUSES = ["active", "quarantined", "under_repair", "retired"] as const

export interface ScaleItem {
  id:                       string
  slid:                     number
  scaleId:                  string
  scaleNumber:              string
  minRange:                 string | null
  minRangeGrams:            number | null
  maxRange:                 string | null
  maxRangeGrams:            number | null
  capacity:                 string | null
  capacityGrams:            number | null
  leastCount:               string | null
  leastCountGrams:          number | null
  lastVerifiedOn:           string | null
  nextVerificationDue:      string | null
  verificationIntervalDays: number
  formVerificationNo:       string | null
  nextCalibrationDue:       string | null
  calibrationIntervalDays:  number
  formCalibrationNo:        string | null
  manufacturer:             string | null
  modelNumber:              string | null
  scaleType:                string | null
  status:                   string
  statusReason:             string | null
  isActive:                 boolean
  createdAt:                string
  updatedAt:                string
}

export interface CreateScalePayload {
  scaleNumber:              string
  scaleType?:               string | null
  minRange?:                string | null
  maxRange?:                string | null
  capacity?:                string | null
  leastCount?:              string | null
  manufacturer?:            string | null
  modelNumber?:             string | null
  lastVerifiedOn?:          string | null
  nextVerificationDue?:     string | null
  verificationIntervalDays?: number
  formVerificationNo?:      string | null
  nextCalibrationDue?:      string | null
  calibrationIntervalDays?: number
  formCalibrationNo?:       string | null
  status?:                  string
  statusReason?:            string | null
  isActive?:                boolean
}

export type UpdateScalePayload = Partial<CreateScalePayload>

export interface ScaleImportRow {
  scaleNumber:              string
  scaleType?:               string | null
  minRange?:                string | null
  maxRange?:                string | null
  capacity?:                string | null
  leastCount?:              string | null
  manufacturer?:            string | null
  modelNumber?:             string | null
  lastVerifiedOn?:          string | null
  nextVerificationDue?:     string | null
  verificationIntervalDays?: number
  formVerificationNo?:      string | null
  nextCalibrationDue?:      string | null
  calibrationIntervalDays?: number
  formCalibrationNo?:       string | null
}

export function apiListScales(
  accessToken: string,
  search?:     string,
  type?:       string,
  status?:     string,
): Promise<ScaleItem[]> {
  const params = new URLSearchParams()
  if (search) params.set("search", search)
  if (type)   params.set("type",   type)
  if (status) params.set("status", status)
  const qs = params.toString() ? `?${params.toString()}` : ""
  return apiGet<ScaleItem[]>(`/api/scales${qs}`, accessToken)
}

export function apiCreateScale(
  accessToken: string,
  payload:     CreateScalePayload,
): Promise<ScaleItem> {
  return apiPost<ScaleItem>("/api/scales", payload, accessToken)
}

export function apiUpdateScale(
  accessToken: string,
  id:          string,
  payload:     UpdateScalePayload,
): Promise<ScaleItem> {
  return apiFetch<ScaleItem>(`/api/scales/${id}`, {
    method: "PATCH",
    body:   JSON.stringify(payload),
    token:  accessToken,
  })
}

export function apiDeleteScale(
  accessToken: string,
  id:          string,
): Promise<null> {
  return apiFetch<null>(`/api/scales/${id}`, {
    method: "DELETE",
    token:  accessToken,
  })
}

export async function apiExportScales(accessToken: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/scales/export`, {
    method: "GET", credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    let code = "UNKNOWN", message = "Export failed"
    try { const b = await res.json(); code = b.error ?? code; message = b.message ?? message } catch { /* */ }
    throw new ApiError(code, message, res.status)
  }
  return res.blob()
}

export function apiImportScales(
  accessToken: string,
  rows:        ScaleImportRow[],
): Promise<ImportResult> {
  return apiPost<ImportResult>("/api/scales/import", { rows }, accessToken)
}

// ── Standard Weights ──────────────────────────────────────────────────────────

export interface StandardWeightItem {
  id:                      string
  slid:                    number
  weightSerialNo:          string
  standardWeight:          string
  weightValueGrams:        number
  lastCalibratedOn:        string | null
  nextCalibrationDue:      string | null
  calibrationIntervalDays: number
  toleranceLimit:          string | null
  toleranceGrams:          number | null
  calibrationLab:          string | null
  certificateNumber:       string | null
  certificateUrl:          string | null
  material:                string | null
  accuracyClass:           string | null
  storageLocation:         string | null
  isActive:                boolean
  inactiveReason:          string | null
  createdAt:               string
  updatedAt:               string
}

export interface CreateWeightPayload {
  weightSerialNo:          string
  standardWeight:          string
  weightValueGrams:        number
  lastCalibratedOn?:       string | null
  nextCalibrationDue?:     string | null
  calibrationIntervalDays?: number
  toleranceLimit?:         string | null
  calibrationLab?:         string | null
  certificateNumber?:      string | null
  material?:               string | null
  accuracyClass?:          string | null
  storageLocation?:        string | null
  isActive?:               boolean
  inactiveReason?:         string | null
}

export type UpdateWeightPayload = Partial<CreateWeightPayload>

export interface WeightImportRow {
  weightSerialNo:          string
  standardWeight:          string
  weightValueGrams:        number
  lastCalibratedOn?:       string | null
  nextCalibrationDue?:     string | null
  calibrationIntervalDays?: number
  toleranceLimit?:         string | null
  material?:               string | null
  accuracyClass?:          string | null
  storageLocation?:        string | null
  calibrationLab?:         string | null
  certificateNumber?:      string | null
}

export function apiListWeights(
  accessToken: string,
  search?:     string,
  isActive?:   string,
): Promise<StandardWeightItem[]> {
  const params = new URLSearchParams()
  if (search)   params.set("search",   search)
  if (isActive) params.set("isActive", isActive)
  const qs = params.toString() ? `?${params.toString()}` : ""
  return apiGet<StandardWeightItem[]>(`/api/weights${qs}`, accessToken)
}

export function apiCreateWeight(
  accessToken: string,
  payload:     CreateWeightPayload,
): Promise<StandardWeightItem> {
  return apiPost<StandardWeightItem>("/api/weights", payload, accessToken)
}

export function apiUpdateWeight(
  accessToken: string,
  id:          string,
  payload:     UpdateWeightPayload,
): Promise<StandardWeightItem> {
  return apiFetch<StandardWeightItem>(`/api/weights/${id}`, {
    method: "PATCH",
    body:   JSON.stringify(payload),
    token:  accessToken,
  })
}

export function apiDeleteWeight(
  accessToken: string,
  id:          string,
): Promise<null> {
  return apiFetch<null>(`/api/weights/${id}`, {
    method: "DELETE",
    token:  accessToken,
  })
}

export async function apiExportWeights(accessToken: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/weights/export`, {
    method: "GET", credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    let code = "UNKNOWN", message = "Export failed"
    try { const b = await res.json(); code = b.error ?? code; message = b.message ?? message } catch { /* */ }
    throw new ApiError(code, message, res.status)
  }
  return res.blob()
}

export function apiImportWeights(
  accessToken: string,
  rows:        WeightImportRow[],
): Promise<ImportResult> {
  return apiPost<ImportResult>("/api/weights/import", { rows }, accessToken)
}

// ── Room Cleaning Types ───────────────────────────────────────────────────────

export const ROOM_CLEANING_DEFAULT_METHODS = ['TypeA', 'TypeB', 'TypeC'] as const
export type RoomCleaningDefaultMethod = typeof ROOM_CLEANING_DEFAULT_METHODS[number]

export interface RoomCleaningTypeItem {
  id:                  string
  cleaningTypeCode:    string
  cleaningTypeName:    string
  cleaningTypeDetails: string | null
  defaultMethod:       RoomCleaningDefaultMethod | null
  displayOrder:        number
  isActive:            boolean
  createdAt:           string
  updatedAt:           string
}

export interface CreateRoomCleaningTypePayload {
  cleaningTypeName:    string
  cleaningTypeDetails?: string
  defaultMethod?:      RoomCleaningDefaultMethod
  displayOrder?:       number
  isActive?:           boolean
}

export interface UpdateRoomCleaningTypePayload {
  cleaningTypeName?:    string
  cleaningTypeDetails?: string | null
  defaultMethod?:       RoomCleaningDefaultMethod | null
  displayOrder?:        number
  isActive?:            boolean
}

export interface RoomCleaningTypeImportRow {
  cleaningTypeName:    string
  cleaningTypeDetails?: string
  defaultMethod?:      RoomCleaningDefaultMethod
  displayOrder?:       number
}

export function apiListRoomCleaningTypes(
  accessToken: string,
  search?: string,
): Promise<RoomCleaningTypeItem[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ""
  return apiGet<RoomCleaningTypeItem[]>(`/api/room-cleaning-types${qs}`, accessToken)
}

export function apiCreateRoomCleaningType(
  accessToken: string,
  payload:     CreateRoomCleaningTypePayload,
): Promise<RoomCleaningTypeItem> {
  return apiPost<RoomCleaningTypeItem>("/api/room-cleaning-types", payload, accessToken)
}

export function apiUpdateRoomCleaningType(
  accessToken: string,
  id:          string,
  payload:     UpdateRoomCleaningTypePayload,
): Promise<RoomCleaningTypeItem> {
  return apiFetch<RoomCleaningTypeItem>(`/api/room-cleaning-types/${id}`, {
    method: "PATCH",
    body:   JSON.stringify(payload),
    token:  accessToken,
  })
}

export function apiDeleteRoomCleaningType(
  accessToken: string,
  id:          string,
): Promise<null> {
  return apiFetch<null>(`/api/room-cleaning-types/${id}`, {
    method: "DELETE",
    token:  accessToken,
  })
}

export async function apiExportRoomCleaningTypes(accessToken: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/room-cleaning-types/export`, {
    method: "GET", credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    let code = "UNKNOWN", message = "Export failed"
    try { const b = await res.json(); code = b.error ?? code; message = b.message ?? message } catch { /* */ }
    throw new ApiError(code, message, res.status)
  }
  return res.blob()
}

export function apiImportRoomCleaningTypes(
  accessToken: string,
  rows:        RoomCleaningTypeImportRow[],
): Promise<ImportResult> {
  return apiPost<ImportResult>("/api/room-cleaning-types/import", { rows }, accessToken)
}

// ── Room Cleaning SOP Steps ───────────────────────────────────────────────────

export const SOP_CLEANING_METHODS  = ['TypeA', 'TypeB', 'TypeC'] as const
export const SOP_EQUIP_SEQUENCES   = ['Before', 'After', 'NA']   as const
export const SOP_STATUSES          = ['pending', 'approved', 'rejected', 'archived'] as const

export type SopCleaningMethod  = typeof SOP_CLEANING_METHODS[number]
export type SopEquipSequence   = typeof SOP_EQUIP_SEQUENCES[number]
export type SopStatus          = typeof SOP_STATUSES[number]

export interface RoomCleaningSopStepItem {
  id:                        string
  slid:                      number
  cleaningTypeId:            string
  cleaningTypeName:          string
  cleaningTypeCode:          string
  stepNumber:                number
  timeAllottedDisplay:       string | null
  cleaningMethod:            SopCleaningMethod
  equipmentCleaningSequence: SopEquipSequence
  procedureText:             string
  chemicalUsed:              string | null
  status:                    SopStatus
  createdAt:                 string
  updatedAt:                 string
}

export interface CreateRoomCleaningSopStepPayload {
  cleaningTypeId:            string
  stepNumber:                number
  timeAllottedDisplay?:      string
  cleaningMethod:            SopCleaningMethod
  equipmentCleaningSequence?: SopEquipSequence
  procedureText:             string
  chemicalUsed?:             string
  status?:                   SopStatus
}

export interface UpdateRoomCleaningSopStepPayload {
  stepNumber?:               number
  timeAllottedDisplay?:      string | null
  cleaningMethod?:           SopCleaningMethod
  equipmentCleaningSequence?: SopEquipSequence
  procedureText?:            string
  chemicalUsed?:             string | null
  status?:                   SopStatus
}

export interface SopStepImportRow {
  cleaningTypeCode:          string
  stepNumber:                number
  timeAllottedDisplay?:      string
  cleaningMethod:            SopCleaningMethod
  equipmentCleaningSequence?: SopEquipSequence
  procedureText:             string
  chemicalUsed?:             string
}

export function apiListRoomCleaningSopSteps(
  accessToken:    string,
  cleaningTypeId?: string,
  status?:        string,
): Promise<RoomCleaningSopStepItem[]> {
  const params = new URLSearchParams()
  if (cleaningTypeId) params.set("cleaningTypeId", cleaningTypeId)
  if (status)         params.set("status",         status)
  const qs = params.toString() ? `?${params.toString()}` : ""
  return apiGet<RoomCleaningSopStepItem[]>(`/api/room-cleaning-sop-steps${qs}`, accessToken)
}

export function apiCreateRoomCleaningSopStep(
  accessToken: string,
  payload:     CreateRoomCleaningSopStepPayload,
): Promise<RoomCleaningSopStepItem> {
  return apiPost<RoomCleaningSopStepItem>("/api/room-cleaning-sop-steps", payload, accessToken)
}

export function apiUpdateRoomCleaningSopStep(
  accessToken: string,
  id:          string,
  payload:     UpdateRoomCleaningSopStepPayload,
): Promise<RoomCleaningSopStepItem> {
  return apiFetch<RoomCleaningSopStepItem>(`/api/room-cleaning-sop-steps/${id}`, {
    method: "PATCH",
    body:   JSON.stringify(payload),
    token:  accessToken,
  })
}

export function apiDeleteRoomCleaningSopStep(
  accessToken: string,
  id:          string,
): Promise<null> {
  return apiFetch<null>(`/api/room-cleaning-sop-steps/${id}`, {
    method: "DELETE",
    token:  accessToken,
  })
}

export async function apiExportRoomCleaningSopSteps(
  accessToken:    string,
  cleaningTypeId?: string,
): Promise<Blob> {
  const qs = cleaningTypeId ? `?cleaningTypeId=${encodeURIComponent(cleaningTypeId)}` : ""
  const res = await fetch(`${API_BASE}/api/room-cleaning-sop-steps/export${qs}`, {
    method: "GET", credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    let code = "UNKNOWN", message = "Export failed"
    try { const b = await res.json(); code = b.error ?? code; message = b.message ?? message } catch { /* */ }
    throw new ApiError(code, message, res.status)
  }
  return res.blob()
}

export function apiImportRoomCleaningSopSteps(
  accessToken: string,
  rows:        SopStepImportRow[],
): Promise<ImportResult> {
  return apiPost<ImportResult>("/api/room-cleaning-sop-steps/import", { rows }, accessToken)
}

// ── Room Inspection1 SOP Steps ────────────────────────────────────────────────

export const INSP1_STATUSES = ['pending', 'approved', 'rejected', 'archived'] as const
export type  Insp1Status    = typeof INSP1_STATUSES[number]

export interface Insp1MediaItem {
  id:           string
  sopStepId:    string
  displayOrder: number
  fileUrl:      string
  fileName:     string | null
  fileType:     string | null
  caption:      string | null
  createdAt:    string
}

export interface RoomInspection1SopStepItem {
  id:               string
  slid:             number
  cleaningTypeId:   string
  cleaningTypeName: string
  cleaningTypeCode: string
  stepNumber:       number
  procedureText:    string
  status:           Insp1Status
  media:            Insp1MediaItem[]
  createdAt:        string
  updatedAt:        string
}

export interface CreateRoomInspection1SopStepPayload {
  cleaningTypeId: string
  stepNumber:     number
  procedureText:  string
  status?:        Insp1Status
}

export interface UpdateRoomInspection1SopStepPayload {
  stepNumber?:    number
  procedureText?: string
  status?:        Insp1Status
}

export interface Insp1ImportRow {
  cleaningTypeCode: string
  stepNumber:       number
  procedureText:    string
}

export function apiListRoomInspection1SopSteps(
  accessToken:     string,
  cleaningTypeId?: string,
  status?:         string,
): Promise<RoomInspection1SopStepItem[]> {
  const params = new URLSearchParams()
  if (cleaningTypeId) params.set("cleaningTypeId", cleaningTypeId)
  if (status)         params.set("status",         status)
  const qs = params.toString() ? `?${params.toString()}` : ""
  return apiGet<RoomInspection1SopStepItem[]>(`/api/room-inspection1-sop-steps${qs}`, accessToken)
}

export function apiCreateRoomInspection1SopStep(
  accessToken: string,
  payload:     CreateRoomInspection1SopStepPayload,
): Promise<RoomInspection1SopStepItem> {
  return apiPost<RoomInspection1SopStepItem>("/api/room-inspection1-sop-steps", payload, accessToken)
}

export function apiUpdateRoomInspection1SopStep(
  accessToken: string,
  id:          string,
  payload:     UpdateRoomInspection1SopStepPayload,
): Promise<RoomInspection1SopStepItem> {
  return apiFetch<RoomInspection1SopStepItem>(`/api/room-inspection1-sop-steps/${id}`, {
    method: "PATCH",
    body:   JSON.stringify(payload),
    token:  accessToken,
  })
}

export function apiDeleteRoomInspection1SopStep(
  accessToken: string,
  id:          string,
): Promise<null> {
  return apiFetch<null>(`/api/room-inspection1-sop-steps/${id}`, {
    method: "DELETE",
    token:  accessToken,
  })
}

export async function apiExportRoomInspection1SopSteps(
  accessToken:     string,
  cleaningTypeId?: string,
): Promise<Blob> {
  const qs = cleaningTypeId ? `?cleaningTypeId=${encodeURIComponent(cleaningTypeId)}` : ""
  const res = await fetch(`${API_BASE}/api/room-inspection1-sop-steps/export${qs}`, {
    method: "GET", credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    let code = "UNKNOWN", message = "Export failed"
    try { const b = await res.json(); code = b.error ?? code; message = b.message ?? message } catch { /* */ }
    throw new ApiError(code, message, res.status)
  }
  return res.blob()
}

export function apiImportRoomInspection1SopSteps(
  accessToken: string,
  rows:        Insp1ImportRow[],
): Promise<ImportResult> {
  return apiPost<ImportResult>("/api/room-inspection1-sop-steps/import", { rows }, accessToken)
}

// ── Inspection1 Media ─────────────────────────────────────────────────────────

export interface AddInsp1MediaPayload {
  fileUrl:   string
  fileName?: string
  fileType?: string
  caption?:  string
}

export function apiAddInspection1Media(
  accessToken: string,
  stepId:      string,
  payload:     AddInsp1MediaPayload,
): Promise<Insp1MediaItem> {
  return apiPost<Insp1MediaItem>(
    `/api/room-inspection1-sop-steps/${stepId}/media`, payload, accessToken,
  )
}

export function apiDeleteInspection1Media(
  accessToken: string,
  stepId:      string,
  mediaId:     string,
): Promise<null> {
  return apiFetch<null>(
    `/api/room-inspection1-sop-steps/${stepId}/media/${mediaId}`,
    { method: "DELETE", token: accessToken },
  )
}

/**
 * Upload an image file for an inspection-1 SOP step.
 * Sends raw binary (application/octet-stream) — no multer required on the API.
 */
export async function apiUploadInspection1MediaFile(
  accessToken: string,
  file: File,
): Promise<{ url: string; fileName: string; fileType: string }> {
  const params = new URLSearchParams({ fileName: file.name, fileType: file.type })
  const res = await fetch(`${API_BASE}/api/uploads/inspection1-media?${params}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/octet-stream",
      Authorization: `Bearer ${accessToken}`,
    },
    body: file,
  })
  if (res.status === 401 && _onUnauthorized) _onUnauthorized()
  if (!res.ok) {
    let code = "UNKNOWN", message = "Upload failed"
    try {
      const b = await res.json()
      code    = b.error   ?? code
      message = b.message ?? message
    } catch { /* ignore */ }
    throw new ApiError(code, message, res.status)
  }
  const json = await res.json()
  return json.data as { url: string; fileName: string; fileType: string }
}

// ── Re-usable upload helper (shared endpoint, same uploads dir) ───────────────
async function apiUploadMediaFile(
  accessToken: string,
  file: File,
): Promise<{ url: string; fileName: string; fileType: string }> {
  return apiUploadInspection1MediaFile(accessToken, file)
}

// ════════════════════════════════════════════════════════════════════════════════
// INSPECTION 2
// ════════════════════════════════════════════════════════════════════════════════

export const INSP2_STATUSES = ['pending', 'approved', 'rejected', 'archived'] as const

export interface Insp2MediaItem {
  id: string; sopStepId: string; displayOrder: number
  fileUrl: string; fileName: string | null; fileType: string | null
  caption: string | null; createdAt: string
}

export interface RoomInspection2SopStepItem {
  id: string; slid: number; cleaningTypeId: string
  cleaningTypeName: string; cleaningTypeCode: string
  stepNumber: number; procedureText: string; status: string
  media: Insp2MediaItem[]; createdAt: string; updatedAt: string
}

export interface AddInsp2MediaPayload {
  fileUrl: string; fileName?: string; fileType?: string; caption?: string
}

export function apiListRoomInspection2SopSteps(
  accessToken: string, cleaningTypeId?: string, status?: string,
): Promise<RoomInspection2SopStepItem[]> {
  const p = new URLSearchParams()
  if (cleaningTypeId) p.set("cleaningTypeId", cleaningTypeId)
  if (status)         p.set("status", status)
  const qs = p.toString()
  return apiFetch<RoomInspection2SopStepItem[]>(
    `/api/room-inspection2-sop-steps${qs ? "?" + qs : ""}`, { token: accessToken },
  )
}

export function apiCreateRoomInspection2SopStep(
  accessToken: string,
  payload: { cleaningTypeId: string; stepNumber: number; procedureText: string },
): Promise<RoomInspection2SopStepItem> {
  return apiPost<RoomInspection2SopStepItem>("/api/room-inspection2-sop-steps", payload, accessToken)
}

export function apiUpdateRoomInspection2SopStep(
  accessToken: string, id: string,
  payload: { stepNumber?: number; procedureText?: string; status?: string },
): Promise<RoomInspection2SopStepItem> {
  return apiFetch<RoomInspection2SopStepItem>(
    `/api/room-inspection2-sop-steps/${id}`,
    { method: "PATCH", body: JSON.stringify(payload), token: accessToken },
  )
}

export function apiDeleteRoomInspection2SopStep(accessToken: string, id: string): Promise<null> {
  return apiFetch<null>(`/api/room-inspection2-sop-steps/${id}`, { method: "DELETE", token: accessToken })
}

export async function apiExportRoomInspection2SopSteps(
  accessToken: string, cleaningTypeId?: string,
): Promise<Blob> {
  const qs = cleaningTypeId ? `?cleaningTypeId=${encodeURIComponent(cleaningTypeId)}` : ""
  const res = await fetch(`${API_BASE}/api/room-inspection2-sop-steps/export${qs}`, {
    method: "GET", credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    let code = "UNKNOWN", message = "Export failed"
    try { const b = await res.json(); code = b.error ?? code; message = b.message ?? message } catch { /* */ }
    throw new ApiError(code, message, res.status)
  }
  return res.blob()
}

export async function apiImportRoomInspection2SopSteps(
  accessToken: string,
  rows: { cleaningTypeCode: string; stepNumber: number; procedureText: string }[],
): Promise<{ created: number; skipped: number; errors: { row: number; message: string }[] }> {
  return apiPost("/api/room-inspection2-sop-steps/import", { rows }, accessToken)
}

export function apiAddInspection2Media(
  accessToken: string, stepId: string, payload: AddInsp2MediaPayload,
): Promise<Insp2MediaItem> {
  return apiPost<Insp2MediaItem>(`/api/room-inspection2-sop-steps/${stepId}/media`, payload, accessToken)
}

export function apiDeleteInspection2Media(
  accessToken: string, stepId: string, mediaId: string,
): Promise<null> {
  return apiFetch<null>(
    `/api/room-inspection2-sop-steps/${stepId}/media/${mediaId}`, { method: "DELETE", token: accessToken },
  )
}

export async function apiUploadInspection2MediaFile(
  accessToken: string, file: File,
): Promise<{ url: string; fileName: string; fileType: string }> {
  return apiUploadMediaFile(accessToken, file)
}

// ════════════════════════════════════════════════════════════════════════════════
// ROOM QAC
// ════════════════════════════════════════════════════════════════════════════════

export const QAC_STATUSES = ['pending', 'approved', 'rejected', 'archived'] as const

export interface QacMediaItem {
  id: string; sopStepId: string; displayOrder: number
  fileUrl: string; fileName: string | null; fileType: string | null
  caption: string | null; createdAt: string
}

export interface RoomQacSopStepItem {
  id: string; slid: number; cleaningTypeId: string
  cleaningTypeName: string; cleaningTypeCode: string
  stepNumber: number; procedureText: string; status: string
  media: QacMediaItem[]; createdAt: string; updatedAt: string
}

export interface AddQacMediaPayload {
  fileUrl: string; fileName?: string; fileType?: string; caption?: string
}

export function apiListRoomQacSopSteps(
  accessToken: string, cleaningTypeId?: string, status?: string,
): Promise<RoomQacSopStepItem[]> {
  const p = new URLSearchParams()
  if (cleaningTypeId) p.set("cleaningTypeId", cleaningTypeId)
  if (status)         p.set("status", status)
  const qs = p.toString()
  return apiFetch<RoomQacSopStepItem[]>(
    `/api/room-qac-sop-steps${qs ? "?" + qs : ""}`, { token: accessToken },
  )
}

export function apiCreateRoomQacSopStep(
  accessToken: string,
  payload: { cleaningTypeId: string; stepNumber: number; procedureText: string },
): Promise<RoomQacSopStepItem> {
  return apiPost<RoomQacSopStepItem>("/api/room-qac-sop-steps", payload, accessToken)
}

export function apiUpdateRoomQacSopStep(
  accessToken: string, id: string,
  payload: { stepNumber?: number; procedureText?: string; status?: string },
): Promise<RoomQacSopStepItem> {
  return apiFetch<RoomQacSopStepItem>(
    `/api/room-qac-sop-steps/${id}`,
    { method: "PATCH", body: JSON.stringify(payload), token: accessToken },
  )
}

export function apiDeleteRoomQacSopStep(accessToken: string, id: string): Promise<null> {
  return apiFetch<null>(`/api/room-qac-sop-steps/${id}`, { method: "DELETE", token: accessToken })
}

export async function apiExportRoomQacSopSteps(
  accessToken: string, cleaningTypeId?: string,
): Promise<Blob> {
  const qs = cleaningTypeId ? `?cleaningTypeId=${encodeURIComponent(cleaningTypeId)}` : ""
  const res = await fetch(`${API_BASE}/api/room-qac-sop-steps/export${qs}`, {
    method: "GET", credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    let code = "UNKNOWN", message = "Export failed"
    try { const b = await res.json(); code = b.error ?? code; message = b.message ?? message } catch { /* */ }
    throw new ApiError(code, message, res.status)
  }
  return res.blob()
}

export async function apiImportRoomQacSopSteps(
  accessToken: string,
  rows: { cleaningTypeCode: string; stepNumber: number; procedureText: string }[],
): Promise<{ created: number; skipped: number; errors: { row: number; message: string }[] }> {
  return apiPost("/api/room-qac-sop-steps/import", { rows }, accessToken)
}

export function apiAddQacMedia(
  accessToken: string, stepId: string, payload: AddQacMediaPayload,
): Promise<QacMediaItem> {
  return apiPost<QacMediaItem>(`/api/room-qac-sop-steps/${stepId}/media`, payload, accessToken)
}

export function apiDeleteQacMedia(
  accessToken: string, stepId: string, mediaId: string,
): Promise<null> {
  return apiFetch<null>(
    `/api/room-qac-sop-steps/${stepId}/media/${mediaId}`, { method: "DELETE", token: accessToken },
  )
}

export async function apiUploadQacMediaFile(
  accessToken: string, file: File,
): Promise<{ url: string; fileName: string; fileType: string }> {
  return apiUploadMediaFile(accessToken, file)
}

// ════════════════════════════════════════════════════════════════════════════════
// EQUIPMENT CLEANING SOP
// ════════════════════════════════════════════════════════════════════════════════

export const EQU_CLEANING_METHODS = ['TypeA', 'TypeB', 'TypeC'] as const
export const EQU_SOP_STATUSES     = ['pending', 'approved', 'rejected', 'archived'] as const

export type EquCleaningMethod = typeof EQU_CLEANING_METHODS[number]
export type EquSopStatus      = typeof EQU_SOP_STATUSES[number]

export interface EquSopMediaItem {
  id: string; sopStepId: string; displayOrder: number
  fileUrl: string; fileName: string | null; fileType: string | null
  caption: string | null; createdAt: string
}

export interface EquCleaningSopStepItem {
  id: string; slid: number; cleaningTypeId: string
  cleaningTypeName: string; cleaningTypeCode: string
  stepNumber: number; timeAllottedDisplay: string | null
  cleaningMethod: EquCleaningMethod
  procedureText: string
  chemicalUsed: string | null
  equipmentUsed: string | null
  status: EquSopStatus
  media: EquSopMediaItem[]
  createdAt: string; updatedAt: string
}

export interface CreateEquCleaningSopStepPayload {
  cleaningTypeId: string; stepNumber: number
  timeAllottedDisplay?: string; cleaningMethod: EquCleaningMethod
  procedureText: string; chemicalUsed?: string
  equipmentUsed?: string; status?: EquSopStatus
}

export interface UpdateEquCleaningSopStepPayload {
  stepNumber?: number; timeAllottedDisplay?: string | null
  cleaningMethod?: EquCleaningMethod; procedureText?: string
  chemicalUsed?: string | null; equipmentUsed?: string | null
  status?: EquSopStatus
}

export interface EquSopImportRow {
  cleaningTypeCode: string; stepNumber: number
  timeAllottedDisplay?: string; cleaningMethod: EquCleaningMethod
  procedureText: string; chemicalUsed?: string; equipmentUsed?: string
}

export interface AddEquSopMediaPayload {
  fileUrl: string; fileName?: string; fileType?: string; caption?: string
}

export function apiListEquCleaningSopSteps(
  accessToken: string, cleaningTypeId?: string, status?: string,
): Promise<EquCleaningSopStepItem[]> {
  const p = new URLSearchParams()
  if (cleaningTypeId) p.set("cleaningTypeId", cleaningTypeId)
  if (status)         p.set("status", status)
  const qs = p.toString()
  return apiFetch<EquCleaningSopStepItem[]>(
    `/api/equ-cleaning-sop-steps${qs ? "?" + qs : ""}`, { token: accessToken },
  )
}

export function apiCreateEquCleaningSopStep(
  accessToken: string, payload: CreateEquCleaningSopStepPayload,
): Promise<EquCleaningSopStepItem> {
  return apiPost<EquCleaningSopStepItem>("/api/equ-cleaning-sop-steps", payload, accessToken)
}

export function apiUpdateEquCleaningSopStep(
  accessToken: string, id: string, payload: UpdateEquCleaningSopStepPayload,
): Promise<EquCleaningSopStepItem> {
  return apiFetch<EquCleaningSopStepItem>(`/api/equ-cleaning-sop-steps/${id}`, {
    method: "PATCH", body: JSON.stringify(payload), token: accessToken,
  })
}

export function apiDeleteEquCleaningSopStep(accessToken: string, id: string): Promise<null> {
  return apiFetch<null>(`/api/equ-cleaning-sop-steps/${id}`, { method: "DELETE", token: accessToken })
}

export async function apiExportEquCleaningSopSteps(
  accessToken: string, cleaningTypeId?: string,
): Promise<Blob> {
  const qs = cleaningTypeId ? `?cleaningTypeId=${encodeURIComponent(cleaningTypeId)}` : ""
  const res = await fetch(`${API_BASE}/api/equ-cleaning-sop-steps/export${qs}`, {
    method: "GET", credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    let code = "UNKNOWN", message = "Export failed"
    try { const b = await res.json(); code = b.error ?? code; message = b.message ?? message } catch { /* */ }
    throw new ApiError(code, message, res.status)
  }
  return res.blob()
}

export function apiImportEquCleaningSopSteps(
  accessToken: string, rows: EquSopImportRow[],
): Promise<{ created: number; skipped: number; errors: { row: number; message: string }[] }> {
  return apiPost("/api/equ-cleaning-sop-steps/import", { rows }, accessToken)
}

export function apiAddEquSopMedia(
  accessToken: string, stepId: string, payload: AddEquSopMediaPayload,
): Promise<EquSopMediaItem> {
  return apiPost<EquSopMediaItem>(`/api/equ-cleaning-sop-steps/${stepId}/media`, payload, accessToken)
}

export function apiDeleteEquSopMedia(
  accessToken: string, stepId: string, mediaId: string,
): Promise<null> {
  return apiFetch<null>(`/api/equ-cleaning-sop-steps/${stepId}/media/${mediaId}`, { method: "DELETE", token: accessToken })
}

export async function apiUploadEquSopMediaFile(
  accessToken: string, file: File,
): Promise<{ url: string; fileName: string; fileType: string }> {
  return apiUploadMediaFile(accessToken, file)
}

// ════════════════════════════════════════════════════════════════════════════════
// EQUIPMENT INSPECTION 1
// ════════════════════════════════════════════════════════════════════════════════

export const EQU_INSP1_STATUSES = ['pending', 'approved', 'rejected', 'archived'] as const
export interface EquInsp1MediaItem { id: string; sopStepId: string; displayOrder: number; fileUrl: string; fileName: string | null; fileType: string | null; caption: string | null; createdAt: string }
export interface EquInsp1SopStepItem { id: string; slid: number; cleaningTypeId: string; cleaningTypeName: string; cleaningTypeCode: string; stepNumber: number; procedureText: string; status: string; media: EquInsp1MediaItem[]; createdAt: string; updatedAt: string }
export interface AddEquInsp1MediaPayload { fileUrl: string; fileName?: string; fileType?: string; caption?: string }

export function apiListEquInsp1SopSteps(accessToken: string, cleaningTypeId?: string, status?: string): Promise<EquInsp1SopStepItem[]> { const p = new URLSearchParams(); if (cleaningTypeId) p.set("cleaningTypeId", cleaningTypeId); if (status) p.set("status", status); const qs = p.toString(); return apiFetch<EquInsp1SopStepItem[]>(`/api/equ-inspection1-sop-steps${qs ? "?" + qs : ""}`, { token: accessToken }) }
export function apiCreateEquInsp1SopStep(accessToken: string, payload: { cleaningTypeId: string; stepNumber: number; procedureText: string }): Promise<EquInsp1SopStepItem> { return apiPost<EquInsp1SopStepItem>("/api/equ-inspection1-sop-steps", payload, accessToken) }
export function apiUpdateEquInsp1SopStep(accessToken: string, id: string, payload: { stepNumber?: number; procedureText?: string; status?: string }): Promise<EquInsp1SopStepItem> { return apiFetch<EquInsp1SopStepItem>(`/api/equ-inspection1-sop-steps/${id}`, { method: "PATCH", body: JSON.stringify(payload), token: accessToken }) }
export function apiDeleteEquInsp1SopStep(accessToken: string, id: string): Promise<null> { return apiFetch<null>(`/api/equ-inspection1-sop-steps/${id}`, { method: "DELETE", token: accessToken }) }
export async function apiExportEquInsp1SopSteps(accessToken: string, cleaningTypeId?: string): Promise<Blob> { const qs = cleaningTypeId ? `?cleaningTypeId=${encodeURIComponent(cleaningTypeId)}` : ""; const res = await fetch(`${API_BASE}/api/equ-inspection1-sop-steps/export${qs}`, { method: "GET", credentials: "include", headers: { Authorization: `Bearer ${accessToken}` } }); if (!res.ok) { let code = "UNKNOWN", message = "Export failed"; try { const b = await res.json(); code = b.error ?? code; message = b.message ?? message } catch { /* */ } throw new ApiError(code, message, res.status) } return res.blob() }
export function apiImportEquInsp1SopSteps(accessToken: string, rows: { cleaningTypeCode: string; stepNumber: number; procedureText: string }[]): Promise<{ created: number; skipped: number; errors: { row: number; message: string }[] }> { return apiPost("/api/equ-inspection1-sop-steps/import", { rows }, accessToken) }
export function apiAddEquInsp1Media(accessToken: string, stepId: string, payload: AddEquInsp1MediaPayload): Promise<EquInsp1MediaItem> { return apiPost<EquInsp1MediaItem>(`/api/equ-inspection1-sop-steps/${stepId}/media`, payload, accessToken) }
export function apiDeleteEquInsp1Media(accessToken: string, stepId: string, mediaId: string): Promise<null> { return apiFetch<null>(`/api/equ-inspection1-sop-steps/${stepId}/media/${mediaId}`, { method: "DELETE", token: accessToken }) }
export async function apiUploadEquInsp1MediaFile(accessToken: string, file: File): Promise<{ url: string; fileName: string; fileType: string }> { return apiUploadMediaFile(accessToken, file) }

// ════════════════════════════════════════════════════════════════════════════════
// EQUIPMENT INSPECTION 2
// ════════════════════════════════════════════════════════════════════════════════

export const EQU_INSP2_STATUSES = ['pending', 'approved', 'rejected', 'archived'] as const
export interface EquInsp2MediaItem { id: string; sopStepId: string; displayOrder: number; fileUrl: string; fileName: string | null; fileType: string | null; caption: string | null; createdAt: string }
export interface EquInsp2SopStepItem { id: string; slid: number; cleaningTypeId: string; cleaningTypeName: string; cleaningTypeCode: string; stepNumber: number; procedureText: string; status: string; media: EquInsp2MediaItem[]; createdAt: string; updatedAt: string }
export interface AddEquInsp2MediaPayload { fileUrl: string; fileName?: string; fileType?: string; caption?: string }

export function apiListEquInsp2SopSteps(accessToken: string, cleaningTypeId?: string, status?: string): Promise<EquInsp2SopStepItem[]> { const p = new URLSearchParams(); if (cleaningTypeId) p.set("cleaningTypeId", cleaningTypeId); if (status) p.set("status", status); const qs = p.toString(); return apiFetch<EquInsp2SopStepItem[]>(`/api/equ-inspection2-sop-steps${qs ? "?" + qs : ""}`, { token: accessToken }) }
export function apiCreateEquInsp2SopStep(accessToken: string, payload: { cleaningTypeId: string; stepNumber: number; procedureText: string }): Promise<EquInsp2SopStepItem> { return apiPost<EquInsp2SopStepItem>("/api/equ-inspection2-sop-steps", payload, accessToken) }
export function apiUpdateEquInsp2SopStep(accessToken: string, id: string, payload: { stepNumber?: number; procedureText?: string; status?: string }): Promise<EquInsp2SopStepItem> { return apiFetch<EquInsp2SopStepItem>(`/api/equ-inspection2-sop-steps/${id}`, { method: "PATCH", body: JSON.stringify(payload), token: accessToken }) }
export function apiDeleteEquInsp2SopStep(accessToken: string, id: string): Promise<null> { return apiFetch<null>(`/api/equ-inspection2-sop-steps/${id}`, { method: "DELETE", token: accessToken }) }
export async function apiExportEquInsp2SopSteps(accessToken: string, cleaningTypeId?: string): Promise<Blob> { const qs = cleaningTypeId ? `?cleaningTypeId=${encodeURIComponent(cleaningTypeId)}` : ""; const res = await fetch(`${API_BASE}/api/equ-inspection2-sop-steps/export${qs}`, { method: "GET", credentials: "include", headers: { Authorization: `Bearer ${accessToken}` } }); if (!res.ok) { let code = "UNKNOWN", message = "Export failed"; try { const b = await res.json(); code = b.error ?? code; message = b.message ?? message } catch { /* */ } throw new ApiError(code, message, res.status) } return res.blob() }
export function apiImportEquInsp2SopSteps(accessToken: string, rows: { cleaningTypeCode: string; stepNumber: number; procedureText: string }[]): Promise<{ created: number; skipped: number; errors: { row: number; message: string }[] }> { return apiPost("/api/equ-inspection2-sop-steps/import", { rows }, accessToken) }
export function apiAddEquInsp2Media(accessToken: string, stepId: string, payload: AddEquInsp2MediaPayload): Promise<EquInsp2MediaItem> { return apiPost<EquInsp2MediaItem>(`/api/equ-inspection2-sop-steps/${stepId}/media`, payload, accessToken) }
export function apiDeleteEquInsp2Media(accessToken: string, stepId: string, mediaId: string): Promise<null> { return apiFetch<null>(`/api/equ-inspection2-sop-steps/${stepId}/media/${mediaId}`, { method: "DELETE", token: accessToken }) }
export async function apiUploadEquInsp2MediaFile(accessToken: string, file: File): Promise<{ url: string; fileName: string; fileType: string }> { return apiUploadMediaFile(accessToken, file) }

// ════════════════════════════════════════════════════════════════════════════════
// EQUIPMENT QAC
// ════════════════════════════════════════════════════════════════════════════════

export const EQU_QAC_STATUSES = ['pending', 'approved', 'rejected', 'archived'] as const
export interface EquQacMediaItem { id: string; sopStepId: string; displayOrder: number; fileUrl: string; fileName: string | null; fileType: string | null; caption: string | null; createdAt: string }
export interface EquQacSopStepItem { id: string; slid: number; cleaningTypeId: string; cleaningTypeName: string; cleaningTypeCode: string; stepNumber: number; procedureText: string; status: string; media: EquQacMediaItem[]; createdAt: string; updatedAt: string }
export interface AddEquQacMediaPayload { fileUrl: string; fileName?: string; fileType?: string; caption?: string }

export function apiListEquQacSopSteps(accessToken: string, cleaningTypeId?: string, status?: string): Promise<EquQacSopStepItem[]> { const p = new URLSearchParams(); if (cleaningTypeId) p.set("cleaningTypeId", cleaningTypeId); if (status) p.set("status", status); const qs = p.toString(); return apiFetch<EquQacSopStepItem[]>(`/api/equ-qac-sop-steps${qs ? "?" + qs : ""}`, { token: accessToken }) }
export function apiCreateEquQacSopStep(accessToken: string, payload: { cleaningTypeId: string; stepNumber: number; procedureText: string }): Promise<EquQacSopStepItem> { return apiPost<EquQacSopStepItem>("/api/equ-qac-sop-steps", payload, accessToken) }
export function apiUpdateEquQacSopStep(accessToken: string, id: string, payload: { stepNumber?: number; procedureText?: string; status?: string }): Promise<EquQacSopStepItem> { return apiFetch<EquQacSopStepItem>(`/api/equ-qac-sop-steps/${id}`, { method: "PATCH", body: JSON.stringify(payload), token: accessToken }) }
export function apiDeleteEquQacSopStep(accessToken: string, id: string): Promise<null> { return apiFetch<null>(`/api/equ-qac-sop-steps/${id}`, { method: "DELETE", token: accessToken }) }
export async function apiExportEquQacSopSteps(accessToken: string, cleaningTypeId?: string): Promise<Blob> { const qs = cleaningTypeId ? `?cleaningTypeId=${encodeURIComponent(cleaningTypeId)}` : ""; const res = await fetch(`${API_BASE}/api/equ-qac-sop-steps/export${qs}`, { method: "GET", credentials: "include", headers: { Authorization: `Bearer ${accessToken}` } }); if (!res.ok) { let code = "UNKNOWN", message = "Export failed"; try { const b = await res.json(); code = b.error ?? code; message = b.message ?? message } catch { /* */ } throw new ApiError(code, message, res.status) } return res.blob() }
export function apiImportEquQacSopSteps(accessToken: string, rows: { cleaningTypeCode: string; stepNumber: number; procedureText: string }[]): Promise<{ created: number; skipped: number; errors: { row: number; message: string }[] }> { return apiPost("/api/equ-qac-sop-steps/import", { rows }, accessToken) }
export function apiAddEquQacMedia(accessToken: string, stepId: string, payload: AddEquQacMediaPayload): Promise<EquQacMediaItem> { return apiPost<EquQacMediaItem>(`/api/equ-qac-sop-steps/${stepId}/media`, payload, accessToken) }
export function apiDeleteEquQacMedia(accessToken: string, stepId: string, mediaId: string): Promise<null> { return apiFetch<null>(`/api/equ-qac-sop-steps/${stepId}/media/${mediaId}`, { method: "DELETE", token: accessToken }) }
export async function apiUploadEquQacMediaFile(accessToken: string, file: File): Promise<{ url: string; fileName: string; fileType: string }> { return apiUploadMediaFile(accessToken, file) }
