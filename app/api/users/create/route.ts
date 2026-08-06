import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { registerSchema } from "@/lib/validation/auth";
import { authorizeSuperadmin } from "@/lib/auth/authorize";
import { hashPassword } from "@/lib/auth/password";
import { uploadProfilePicture, StorageValidationError } from "@/lib/storage";

// Superadmin direct account creation (phases-plan 1.6 / Client-Requests.md
// "Superadmin adds someone"). Same field set and validation as
// self-registration (registerSchema, shared rather than duplicated — see
// its comment in lib/validation/auth.ts), but the account is "active"
// immediately, no approval step and no notification email: the superadmin
// already made the account and hands over the login details themselves.
export async function POST(request: Request) {
  const auth = await authorizeSuperadmin();
  if (!auth.ok) return auth.response;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse({
    firstName: formData.get("firstName"),
    middleName: formData.get("middleName") || undefined,
    lastName: formData.get("lastName"),
    suffix: formData.get("suffix") || undefined,
    contactNumber: formData.get("contactNumber") || undefined,
    email: formData.get("email"),
    description: formData.get("description") || undefined,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { email, password, ...profile } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);

  const [created] = await db
    .insert(users)
    .values({
      ...profile,
      email: normalizedEmail,
      passwordHash,
      role: "user",
      status: "active",
      createdByUserId: auth.user.id,
    })
    .returning({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email });

  const picture = formData.get("profilePicture");
  if (picture instanceof File && picture.size > 0) {
    try {
      const { url } = await uploadProfilePicture({ userId: created.id, file: picture });
      await db.update(users).set({ profilePictureUrl: url }).where(eq(users.id, created.id));
    } catch (error) {
      if (error instanceof StorageValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  }

  return NextResponse.json({
    message: "Account created. Share the login details with them directly.",
    user: created,
  });
}
