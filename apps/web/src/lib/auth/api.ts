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
  toleranceGrams?:         number | null
  calibrationLab?:         string | null
  certificateNumber?:      string | null
  certificateUrl?:         string | null
  material?:               string | null
  accuracyClass?:          string | null
  storageLocation?:        string | null
  isActive?:               boolean
  inactiveReason?:         string | null
}

export interface UpdateWeightPayload {
  weightSerialNo?:         string
  standardWeight?:         string
  weightValueGrams?:       number
  lastCalibratedOn?:       string | null
  nextCalibrationDue?:     string | null
  calibrationIntervalDays?: number
  toleranceLimit?:         string | null
  toleranceGrams?:         number | null
  calibrationLab?:         string | null
  certificateNumber?:      string | null
  certificateUrl?:         string | null
  material?:               string | null
  accuracyClass?:          string | null
  storageLocation?:        string | null
  isActive?:               boolean
  inactiveReason?:         string | null
}

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
  search?: string,
): Promise<StandardWeightItem[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ""
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

export function apiImportWeights(
  accessToken: string,
  rows:        WeightImportRow[],
): Promise<ImportResult> {
  return apiPost<ImportResult>("/api/weights/import", { rows }, accessToken)
}

// ── Scales ────────────────────────────────────────────────────────────────────

export const SCALE_TYPES    = ['analytical', 'precision', 'industrial', 'moisture', 'other'] as const
export const SCALE_STATUSES = ['active', 'quarantined', 'under_repair', 'retired'] as const
export type ScaleType   = typeof SCALE_TYPES[number]
export type ScaleStatus = typeof SCALE_STATUSES[number]

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
  scaleType:                ScaleType | null
  status:                   ScaleStatus
  statusReason:             string | null
  isActive:                 boolean
  createdAt:                string
  updatedAt:                string
}

export interface CreateScalePayload {
  scaleNumber:              string
  minRange?:                string | null
  minRangeGrams?:           number | null
  maxRange?:                string | null
  maxRangeGrams?:           number | null
  capacity?:                string | null
  capacityGrams?:           number | null
  leastCount?:              string | null
  leastCountGrams?:         number | null
  lastVerifiedOn?:          string | null
  nextVerificationDue?:     string | null
  verificationIntervalDays?: number
  formVerificationNo?:      string | null
  nextCalibrationDue?:      string | null
  calibrationIntervalDays?: number
  formCalibrationNo?:       string | null
  manufacturer?:            string | null
  modelNumber?:             string | null
  scaleType?:               ScaleType | null
  status?:                  ScaleStatus
  statusReason?:            string | null
  isActive?:                boolean
}

export type UpdateScalePayload = Partial<CreateScalePayload>

export interface ScaleImportRow {
  scaleNumber:              string
  minRange?:                string | null
  minRangeGrams?:           number | null
  maxRange?:                string | null
  maxRangeGrams?:           number | null
  capacity?:                string | null
  capacityGrams?:           number | null
  leastCount?:              string | null
  leastCountGrams?:         number | null
  lastVerifiedOn?:          string | null
  nextVerificationDue?:     string | null
  verificationIntervalDays?: number
  formVerificationNo?:      string | null
  nextCalibrationDue?:      string | null
  calibrationIntervalDays?: number
  formCalibrationNo?:       string | null
  manufacturer?:            string | null
  modelNumber?:             string | null
  scaleType?:               ScaleType | null
}

export function apiListScales(
  accessToken: string,
  search?:    string,
  scaleType?: string,
  status?:    string,
): Promise<ScaleItem[]> {
  const params = new URLSearchParams()
  if (search)    params.set("search", search)
  if (scaleType) params.set("type",   scaleType)
  if (status)    params.set("status", status)
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

export function apiImportScales(
  accessToken: string,
  rows:        ScaleImportRow[],
): Promise<ImportResult> {
  return apiPost<ImportResult>("/api/scales/import", { rows }, accessToken)
}
