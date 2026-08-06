import { cache } from "react";
import { cookies } from "next/headers";
import { generateIdFromEntropySize } from "lucia";
import type { Session, User } from "lucia";
import { eq } from "drizzle-orm";
import { lucia } from "./lucia";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";

// Two session lifetimes: a normal login vs. "remember me" (phases-plan 1.1).
//
// Lucia v3's built-in renewal (Lucia.validateSession) is NOT used here. Its
// renewal threshold and target length are both derived from a single
// instance-wide `sessionExpiresIn` (see lucia.ts, fixed at 1 day). Since one
// Lucia instance can't hold two different lifetimes, letting Lucia manage
// renewal would silently downgrade a 30-day remember-me session to a 1-day
// renewal cycle the first time it entered its last 12 hours of life —
// exactly the users who logged in a day or two ago and stepped away. Instead
// we read/write the `sessions` row ourselves, and use Lucia only for cookie
// serialization and DB-agnostic invalidation.
const ONE_DAY_MS = 1000 * 60 * 60 * 24;
export const DEFAULT_SESSION_DURATION_MS = ONE_DAY_MS;
export const REMEMBER_ME_SESSION_DURATION_MS = ONE_DAY_MS * 30;

export async function createUserSession(userId: string, durationMs: number): Promise<Session> {
  const sessionId = generateIdFromEntropySize(25);
  const expiresAt = new Date(Date.now() + durationMs);
  await db.insert(sessions).values({ id: sessionId, userId, expiresAt });
  return { id: sessionId, userId, expiresAt, fresh: false } as Session;
}

type AuthResult = { user: User; session: Session } | { user: null; session: null };

// Reads the session cookie, validates it against the DB, and refreshes or
// clears the cookie as needed. Cached per-request so multiple server
// components calling this in the same render don't each hit the DB.
export const validateRequest = cache(async (): Promise<AuthResult> => {
  const sessionId = (await cookies()).get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) {
    return { user: null, session: null };
  }

  const [row] = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) {
    return await clearInvalidSessionCookie();
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return await clearInvalidSessionCookie();
  }

  // Classify by remaining lifetime at issuance time, not just "> 1 day
  // left now": a remember-me session in its final day should still be
  // treated as remember-me for renewal purposes, not silently demoted.
  // We infer the original duration from whichever bucket the remaining
  // time is closer to on a log scale — in practice this project only ever
  // issues exactly two durations, so a simple midpoint threshold is exact.
  const remainingMs = row.expiresAt.getTime() - Date.now();
  const midpointMs = (DEFAULT_SESSION_DURATION_MS + REMEMBER_ME_SESSION_DURATION_MS) / 2;
  const originalDurationMsGuess =
    remainingMs > midpointMs ? REMEMBER_ME_SESSION_DURATION_MS : DEFAULT_SESSION_DURATION_MS;

  let session: Session = {
    id: sessionId,
    userId: row.userId,
    expiresAt: row.expiresAt,
    fresh: false,
  } as Session;

  if (remainingMs < originalDurationMsGuess / 2) {
    const expiresAt = new Date(Date.now() + originalDurationMsGuess);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, sessionId));
    session = { ...session, expiresAt, fresh: true };
  }

  const [dbUser] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);

  if (!dbUser) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return await clearInvalidSessionCookie();
  }

  // Build the same safe attribute subset lucia.ts's getUserAttributes()
  // exposes — never spread the raw DB row, which also carries passwordHash.
  const user: User = {
    id: dbUser.id,
    email: dbUser.email,
    firstName: dbUser.firstName,
    middleName: dbUser.middleName,
    lastName: dbUser.lastName,
    suffix: dbUser.suffix,
    contactNumber: dbUser.contactNumber,
    description: dbUser.description,
    profilePictureUrl: dbUser.profilePictureUrl,
    role: dbUser.role,
    status: dbUser.status,
  };

  // Next.js throws when setting cookies during a page render (only route
  // handlers and server actions may do so) — this is expected there.
  try {
    if (session.fresh) {
      const cookieStore = await cookies();
      const sessionCookie = lucia.createSessionCookie(session.id);
      cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    }
  } catch {
    // Called from a page render — cookie will be corrected on next request.
  }

  return { user, session };
});

async function clearInvalidSessionCookie(): Promise<{ user: null; session: null }> {
  try {
    const cookieStore = await cookies();
    const blank = lucia.createBlankSessionCookie();
    cookieStore.set(blank.name, blank.value, blank.attributes);
  } catch {
    // Called from a page render — cookie will be corrected on next request.
  }
  return { user: null, session: null };
}

// Throws-by-redirect helper for pages that require any authenticated user.
export async function requireUser() {
  const { user } = await validateRequest();
  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return user;
}

// Throws-by-redirect helper for pages restricted to superadmin (phases-plan
// 1.3). Sends a signed-in non-superadmin to the dashboard rather than back
// to /login, since they're already authenticated — /login would be
// confusing. Route handlers should use authorizeSuperadmin() instead, since
// they can't redirect.
export async function requireSuperadmin() {
  const user = await requireUser();
  if (user.role !== "superadmin") {
    const { redirect } = await import("next/navigation");
    redirect("/dashboard");
  }
  return user;
}
