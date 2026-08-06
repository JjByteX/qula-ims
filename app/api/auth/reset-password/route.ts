import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { verifyPasswordResetToken, consumePasswordResetToken } from "@/lib/auth/reset-token";
import { hashPassword } from "@/lib/auth/password";
import { lucia } from "@/lib/auth/lucia";

// Lets the reset-password page check the token as soon as it loads, so a
// dead link shows "invalid or expired" immediately instead of only after
// the user fills out the form and submits.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
  const check = await verifyPasswordResetToken(token);
  return NextResponse.json({ valid: check.valid });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const { token, password } = parsed.data;

  const check = await verifyPasswordResetToken(token);
  if (!check.valid) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(password);
  await db.update(users).set({ passwordHash }).where(eq(users.id, check.userId));
  await consumePasswordResetToken(check.tokenId);

  // A password reset should end every existing session, including any
  // session on the device making this request — the whole point is that a
  // stale/compromised credential can no longer be relied on.
  await lucia.invalidateUserSessions(check.userId);

  return NextResponse.json({ message: "Password updated. You can now log in." });
}
