import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { registerSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth/password";
import { uploadProfilePicture, StorageValidationError } from "@/lib/storage";
import { sendNewRegistrationEmail } from "@/lib/email/registration";
import { logActivity } from "@/lib/activity/log";

// Self-registration (phases-plan 1.4 / Client-Requests.md "Self-registration").
// Submission is stored as status "pending" — same shape a superadmin-created
// account ends up with, just missing the approval step (phases-plan 1.5
// handles turning pending into active or denied). No session is created
// here: a pending account can't log in yet (see the login route's pending
// check), so there's nothing to sign the applicant into.
export async function POST(request: Request) {
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
    // Deliberately specific here, unlike login/forgot-password's generic
    // errors: those two guard against account enumeration on endpoints an
    // attacker could probe silently, but registration already requires the
    // real applicant to know their own email, and a vague error would just
    // leave a legitimate second attempt stuck with no way to proceed.
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
      status: "pending",
    })
    .returning({ id: users.id, firstName: users.firstName, lastName: users.lastName });

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

  await logActivity({
    actorUserId: null,
    action: "user.registered",
    targetType: "user",
    targetId: created.id,
    detail: { email: normalizedEmail },
  });

  const superadmins = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.role, "superadmin"));
  await Promise.all(
    superadmins.map((admin) =>
      sendNewRegistrationEmail({
        to: admin.email,
        applicantName: `${created.firstName} ${created.lastName}`,
      }),
    ),
  );

  return NextResponse.json({
    message: "Your request has been submitted. A superadmin will review it shortly.",
  });
}
