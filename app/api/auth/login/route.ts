import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { loginSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/lib/auth/password";
import { lucia } from "@/lib/auth/lucia";
import {
  createUserSession,
  DEFAULT_SESSION_DURATION_MS,
  REMEMBER_ME_SESSION_DURATION_MS,
} from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }
  const { email, password, rememberMe } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  // Same generic error for "no such user" and "wrong password" so login
  // can't be used to enumerate registered emails.
  const genericError = NextResponse.json(
    { error: "Incorrect email or password." },
    { status: 401 },
  );

  if (!user) {
    return genericError;
  }

  const validPassword = await verifyPassword(user.passwordHash, password);
  if (!validPassword) {
    return genericError;
  }

  if (user.status === "pending") {
    return NextResponse.json(
      { error: "Your account is awaiting approval from a superadmin." },
      { status: 403 },
    );
  }
  if (user.status === "denied") {
    return NextResponse.json(
      { error: "This account request was denied. Contact a superadmin." },
      { status: 403 },
    );
  }

  const durationMs = rememberMe ? REMEMBER_ME_SESSION_DURATION_MS : DEFAULT_SESSION_DURATION_MS;
  const session = await createUserSession(user.id, durationMs);
  const sessionCookie = lucia.createSessionCookie(session.id);
  (await cookies()).set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  });
}
