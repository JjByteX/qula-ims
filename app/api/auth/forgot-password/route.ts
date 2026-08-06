import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { createPasswordResetToken } from "@/lib/auth/reset-token";
import { sendPasswordResetEmail } from "@/lib/email/password-reset";

// Always returns the same generic response whether or not the email is
// registered, and whether or not the account is active — same reasoning
// as the login route's generic error: this endpoint must not be usable to
// enumerate registered emails.
const genericResponse = NextResponse.json({
  message: "If that email is registered, a reset link is on its way.",
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email.toLowerCase()))
    .limit(1);

  // Only active accounts can reset a password — a pending or denied
  // account has no working login to "recover" yet.
  if (!user || user.status !== "active") {
    return genericResponse;
  }

  const rawToken = await createPasswordResetToken(user.id);
  await sendPasswordResetEmail({
    to: user.email,
    firstName: user.firstName,
    rawToken,
  });

  return genericResponse;
}
