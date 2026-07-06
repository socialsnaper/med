/**
 * middleware.ts — Next.js Edge Middleware
 *
 * Runs on every matched request BEFORE the page renders.
 * Uses `jose` (not jsonwebtoken) because the Edge runtime does not support Node.js crypto.
 *
 * Responsibilities:
 *  1. Let public routes (/, /login, /2fa/*, /change-password) through freely.
 *  2. For protected routes: verify the httpOnly `access_token` cookie with jose.
 *  3. Redirect unauthenticated requests to /login.
 *  4. Redirect /dashboard to the user's role-appropriate section.
 *  5. Redirect to /dashboard if a logged-in user hits /login.
 *  6. Return 403 JSON for unauthorised API-style requests (Accept: application/json).
 */

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, type JWTPayload } from 'jose'

// ── Route rules (inlined — Edge runtime cannot do dynamic imports) ─────────────

const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/admin':       ['users', 'audit', 'config'],
  '/quality':     ['quality'],
  '/operations':  ['batch', 'rooms'],
  '/maintenance': ['equipment'],
  '/warehouse':   ['inventory'],
  '/data':        ['config'],
}

const PROTECTED_PREFIXES = [...Object.keys(ROUTE_PERMISSIONS), '/dashboard']

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  )
}

function isAuthPath(pathname: string): boolean {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/change-password') ||
    pathname.startsWith('/2fa')
  )
}

function defaultRoute(perms: Record<string, string>): string {
  const has = (k: string) => perms[k] && perms[k] !== 'none'
  if (has('users') || (has('config') && has('audit'))) return '/admin'
  if (has('quality')) return '/quality'
  if (has('batch') || has('rooms')) return '/operations'
  if (has('equipment')) return '/maintenance'
  if (has('inventory')) return '/warehouse'
  return '/operations'
}

// ── JWT verification ──────────────────────────────────────────────────────────

interface DigilogJWT extends JWTPayload {
  sid: string
  role: string
  roleName: string
  perms: Record<string, string>
}

async function verifyAccessToken(token: string): Promise<DigilogJWT | null> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    return payload as DigilogJWT
  } catch {
    return null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function redirectTo(url: string, request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(url, request.url))
}

function unauthorized(request: NextRequest): NextResponse {
  // JSON clients get a 401 response; browsers get redirected to /login
  const acceptsJson = request.headers.get('accept')?.includes('application/json')
  if (acceptsJson) {
    return new NextResponse(
      JSON.stringify({ success: false, error: 'UNAUTHORIZED', message: 'Authentication required' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    )
  }
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('from', request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('access_token')?.value

  // ── Always allow Next.js internals ───────────────────────────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|css|js|woff2?)$/)
  ) {
    return NextResponse.next()
  }

  // ── Auth pages: redirect logged-in users away ─────────────────────────────
  if (isAuthPath(pathname)) {
    if (token) {
      const payload = await verifyAccessToken(token)
      if (payload) {
        // Already authenticated — send to their home section
        return redirectTo(defaultRoute(payload.perms), request)
      }
    }
    return NextResponse.next()
  }

  // ── Public root → redirect to login ──────────────────────────────────────
  if (pathname === '/') {
    return redirectTo('/login', request)
  }

  // ── Protected routes ──────────────────────────────────────────────────────
  if (isProtectedPath(pathname)) {
    if (!token) return unauthorized(request)

    const payload = await verifyAccessToken(token)
    if (!payload) {
      // Token invalid or expired — clear cookie and redirect to login
      const response = redirectTo('/login', request)
      response.cookies.delete('access_token')
      return response
    }

    // ── /dashboard → smart redirect to role's home section ─────────────────
    if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
      return redirectTo(defaultRoute(payload.perms), request)
    }

    // ── Check route-level permission ────────────────────────────────────────
    const matchedPrefix = Object.keys(ROUTE_PERMISSIONS).find(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
    )

    if (matchedPrefix) {
      const allowedPerms = ROUTE_PERMISSIONS[matchedPrefix]
      const permitted = allowedPerms.some(
        (key) => payload.perms[key] && payload.perms[key] !== 'none',
      )
      if (!permitted) {
        return redirectTo(defaultRoute(payload.perms), request)
      }
    }

    // ── Forward user identity to the page via request headers ──────────────
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id',       payload.sub)
    requestHeaders.set('x-user-role',     payload.roleName)
    requestHeaders.set('x-user-schema',   payload.sid)

    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  return NextResponse.next()
}

// ── Matcher ───────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all routes except:
     *  - _next/static  (static files)
     *  - _next/image   (image optimisation)
     *  - favicon.ico
     *  - api/ routes on the Next.js side (none yet, but good practice)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
