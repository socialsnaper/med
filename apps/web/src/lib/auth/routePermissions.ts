/**
 * routePermissions.ts
 *
 * Maps URL path prefixes to the permission keys that grant access.
 * The middleware checks the `perms` object inside the JWT:
 *   { batch: 'full'|'read'|'own'|'none', quality: 'full'|..., ... }
 * A user may enter a route if at least one of the listed permission keys
 * has a value other than 'none'.
 *
 * System Administrator has every permission set to 'full' and can access all routes.
 */

export type RouteRule = {
  /** At least one of these permission keys must be !== 'none' */
  anyPerm: string[]
}

/** Route prefix → access rule */
export const ROUTE_PERMISSIONS: Record<string, RouteRule> = {
  '/admin':       { anyPerm: ['users', 'audit', 'config'] },
  '/quality':     { anyPerm: ['quality'] },
  '/operations':  { anyPerm: ['batch', 'rooms'] },
  '/maintenance': { anyPerm: ['equipment'] },
  '/warehouse':   { anyPerm: ['inventory'] },
  '/data':        { anyPerm: ['config'] },
}

/**
 * All routes that require authentication.
 * Auth routes (/login, /change-password, /2fa/*) are public.
 */
export const PROTECTED_PREFIXES = Object.keys(ROUTE_PERMISSIONS).concat(['/dashboard'])

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
}

export function isAuthPath(pathname: string): boolean {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/change-password') ||
    pathname.startsWith('/2fa')
  )
}

/**
 * Given a decoded JWT `perms` map, return the best landing route for the user.
 * Priority: admin → quality → operations
 */
export function defaultRouteForPerms(perms: Record<string, string>): string {
  const has = (key: string) => perms[key] && perms[key] !== 'none'

  if (has('users') || (has('config') && has('audit'))) return '/admin'
  if (has('quality')) return '/quality'
  if (has('batch') || has('rooms')) return '/operations'
  if (has('equipment')) return '/maintenance'
  if (has('inventory')) return '/warehouse'
  return '/operations'
}

/**
 * Returns true if the user's perms satisfy the route rule.
 */
export function canAccess(perms: Record<string, string>, rule: RouteRule): boolean {
  return rule.anyPerm.some((key) => perms[key] && perms[key] !== 'none')
}
