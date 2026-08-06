import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { lucia } from "@/lib/auth/lucia";

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(lucia.sessionCookieName)?.value ?? null;

  if (sessionId) {
    // Deletes the row directly; safe to call even if the session was
    // created by our own createUserSession() rather than lucia.createSession(),
    // since invalidateSession() only deletes by id and doesn't depend on
    // how the row was written.
    await lucia.invalidateSession(sessionId);
  }

  const blankCookie = lucia.createBlankSessionCookie();
  cookieStore.set(blankCookie.name, blankCookie.value, blankCookie.attributes);

  return NextResponse.json({ success: true });
}
