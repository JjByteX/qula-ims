import { NextResponse, type NextRequest } from "next/server";

// Edge-safe fast path only. Middleware runs before any Node.js code and
// can't reach Postgres (lib/auth/lucia.ts imports db/client.ts, which
// isn't edge-compatible), so this can only check "does a session cookie
// exist" — not whether it's valid, expired, or which role it belongs to.
// Real validation (lib/auth/session.ts's validateRequest, requireUser,
// requireSuperadmin) and the superadmin check for API routes
// (lib/auth/authorize.ts's authorizeUser/authorizeSuperadmin) still run in
// the page/route handler itself and remain the actual source of truth.
// This layer only saves a render/DB round trip for the common case of "no
// cookie at all" and keeps unauthenticated users from ever reaching a
// protected page's UI.
const SESSION_COOKIE_NAME = "auth_session";

// Pages under here require any signed-in user (phases-plan 1.3 protects
// superadmin-only routes specifically; everything else here just requires
// login, matching Client-Requests.md — regular users can use the whole
// app, only specific actions are superadmin-gated).
const PROTECTED_PAGE_PREFIXES = ["/dashboard", "/budget", "/projects", "/activity", "/settings", "/users"];

// API routes that are superadmin-only end to end (account creation,
// pending-request approval/denial per Client-Requests.md). Fine-grained or
// self-vs-others checks (e.g. profile edit) still happen in the route
// itself via authorizeUser(), since "own profile" can't be decided from a
// cookie alone.
const SUPERADMIN_ONLY_API_PREFIXES = ["/api/users/create", "/api/users/pending"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);

  if (SUPERADMIN_ONLY_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (!hasSessionCookie) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    // Role itself is checked in-route via authorizeSuperadmin(), which has
    // DB access; middleware only rules out the "not logged in at all" case.
    return NextResponse.next();
  }

  if (PROTECTED_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (!hasSessionCookie) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/budget/:path*",
    "/projects/:path*",
    "/activity/:path*",
    "/settings/:path*",
    "/users/:path*",
    "/api/users/:path*",
  ],
};
