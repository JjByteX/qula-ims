import { NextResponse } from "next/server";
import type { User } from "lucia";
import { validateRequest } from "./session";

type AuthorizeResult<T> = { ok: true; user: T } | { ok: false; response: NextResponse };

// Route-handler counterpart to requireUser()/requireSuperadmin(). Those
// redirect, which only works from a page render or server action — a route
// handler has to return a Response instead, so this returns a discriminated
// result the caller checks and returns directly:
//
//   const auth = await authorizeUser();
//   if (!auth.ok) return auth.response;
//   // auth.user is defined below
export async function authorizeUser(): Promise<AuthorizeResult<User>> {
  const { user } = await validateRequest();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sign in required." }, { status: 401 }),
    };
  }
  return { ok: true, user };
}

// Same as authorizeUser(), plus the superadmin-only check (phases-plan 1.3).
export async function authorizeSuperadmin(): Promise<AuthorizeResult<User>> {
  const auth = await authorizeUser();
  if (!auth.ok) return auth;
  if (auth.user.role !== "superadmin") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "This action requires superadmin access." },
        { status: 403 },
      ),
    };
  }
  return auth;
}
