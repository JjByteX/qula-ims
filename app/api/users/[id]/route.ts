import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { profileUpdateSchema } from "@/lib/validation/auth";
import { authorizeUser } from "@/lib/auth/authorize";
import { uploadProfilePicture, deleteFile, getPublicUrl, StorageValidationError } from "@/lib/storage";

// Profile view (phases-plan 1.7 / Client-Requests.md "Anyone can view any
// profile"). Any signed-in user, no self-or-superadmin check — that
// restriction only applies to editing. passwordHash is the one column
// deliberately left out of the select, same reasoning as
// lib/auth/session.ts's validateRequest never spreading the raw DB row.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [profile] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      middleName: users.middleName,
      lastName: users.lastName,
      suffix: users.suffix,
      contactNumber: users.contactNumber,
      description: users.description,
      profilePictureUrl: users.profilePictureUrl,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
  return NextResponse.json({ profile });
}

// Profile edit (phases-plan 1.7 / Client-Requests.md "only superadmin or
// that person can edit it"). multipart/form-data so the same request can
// carry a replacement profile picture, same approach as
// app/api/auth/register/route.ts.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const isSelf = auth.user.id === id;
  if (!isSelf && auth.user.role !== "superadmin") {
    return NextResponse.json(
      { error: "You can only edit your own profile." },
      { status: 403 },
    );
  }

  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
  }

  const parsed = profileUpdateSchema.safeParse({
    firstName: formData.get("firstName"),
    middleName: formData.get("middleName") || undefined,
    lastName: formData.get("lastName"),
    suffix: formData.get("suffix") || undefined,
    contactNumber: formData.get("contactNumber") || undefined,
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let profilePictureUrl = target.profilePictureUrl;
  const picture = formData.get("profilePicture");
  if (picture instanceof File && picture.size > 0) {
    try {
      const { url } = await uploadProfilePicture({ userId: id, file: picture });
      profilePictureUrl = url;
    } catch (error) {
      if (error instanceof StorageValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
    // Replace, not accumulate: remove the old picture once the new one is
    // safely uploaded, so a mid-upload failure above never leaves the
    // profile with no picture at all.
    if (target.profilePictureUrl) {
      const oldKey = target.profilePictureUrl.replace(`${getPublicUrl("")}`, "");
      await deleteFile(oldKey).catch(() => {
        // Old file cleanup is best-effort — an orphaned R2 object is a
        // minor storage cost, not worth failing the whole edit over.
      });
    }
  }

  const [updated] = await db
    .update(users)
    .set({ ...parsed.data, profilePictureUrl, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      middleName: users.middleName,
      lastName: users.lastName,
      suffix: users.suffix,
      contactNumber: users.contactNumber,
      description: users.description,
      profilePictureUrl: users.profilePictureUrl,
      role: users.role,
      status: users.status,
    });

  return NextResponse.json({ profile: updated });
}
