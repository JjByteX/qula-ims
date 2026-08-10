import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { profileUpdateSchema } from "@/lib/validation/auth";
import { authorizeUser } from "@/lib/auth/authorize";
import {
  uploadProfilePicture,
  uploadPaymentQrCode,
  uploadPaymentSignature,
  deleteFile,
  getPublicUrl,
  StorageValidationError,
} from "@/lib/storage";
import { logActivity } from "@/lib/activity/log";
import { diffFields } from "@/lib/activity/diff";

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
      paymentQrCodeUrl: users.paymentQrCodeUrl,
      paymentMethod: users.paymentMethod,
      paymentAccountName: users.paymentAccountName,
      paymentBank: users.paymentBank,
      paymentAccountNumber: users.paymentAccountNumber,
      paymentSignatureUrl: users.paymentSignatureUrl,
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
    paymentMethod: formData.get("paymentMethod") || undefined,
    paymentAccountName: formData.get("paymentAccountName") || undefined,
    paymentBank: formData.get("paymentBank") || undefined,
    paymentAccountNumber: formData.get("paymentAccountNumber") || undefined,
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
  } else if (formData.get("removeProfilePicture") === "true" && target.profilePictureUrl) {
    // Explicit removal (the crop dialog's "Remove picture" action) —
    // a separate flag from just omitting profilePicture, since omitting
    // it already means "leave the current picture alone" for a normal
    // text-only save.
    const oldKey = target.profilePictureUrl.replace(`${getPublicUrl("")}`, "");
    await deleteFile(oldKey).catch(() => {});
    profilePictureUrl = null;
  }

  // Payment QR code and signature (docs/phases-plan-revision-1.md Phase
  // 12.2) — same pick-file-then-preview, replace-then-cleanup-old
  // pattern as the profile picture just above, just a different pair of
  // fields and storage functions.
  let paymentQrCodeUrl = target.paymentQrCodeUrl;
  const paymentQrCode = formData.get("paymentQrCode");
  if (paymentQrCode instanceof File && paymentQrCode.size > 0) {
    try {
      const { url } = await uploadPaymentQrCode({ userId: id, file: paymentQrCode });
      paymentQrCodeUrl = url;
    } catch (error) {
      if (error instanceof StorageValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
    if (target.paymentQrCodeUrl) {
      const oldKey = target.paymentQrCodeUrl.replace(`${getPublicUrl("")}`, "");
      await deleteFile(oldKey).catch(() => {});
    }
  } else if (formData.get("removePaymentQrCode") === "true" && target.paymentQrCodeUrl) {
    const oldKey = target.paymentQrCodeUrl.replace(`${getPublicUrl("")}`, "");
    await deleteFile(oldKey).catch(() => {});
    paymentQrCodeUrl = null;
  }

  let paymentSignatureUrl = target.paymentSignatureUrl;
  const paymentSignature = formData.get("paymentSignature");
  if (paymentSignature instanceof File && paymentSignature.size > 0) {
    try {
      const { url } = await uploadPaymentSignature({ userId: id, file: paymentSignature });
      paymentSignatureUrl = url;
    } catch (error) {
      if (error instanceof StorageValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
    if (target.paymentSignatureUrl) {
      const oldKey = target.paymentSignatureUrl.replace(`${getPublicUrl("")}`, "");
      await deleteFile(oldKey).catch(() => {});
    }
  } else if (formData.get("removePaymentSignature") === "true" && target.paymentSignatureUrl) {
    const oldKey = target.paymentSignatureUrl.replace(`${getPublicUrl("")}`, "");
    await deleteFile(oldKey).catch(() => {});
    paymentSignatureUrl = null;
  }

  const [updated] = await db
    .update(users)
    .set({
      ...parsed.data,
      profilePictureUrl,
      paymentQrCodeUrl,
      paymentSignatureUrl,
      updatedAt: new Date(),
    })
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
      paymentQrCodeUrl: users.paymentQrCodeUrl,
      paymentMethod: users.paymentMethod,
      paymentAccountName: users.paymentAccountName,
      paymentBank: users.paymentBank,
      paymentAccountNumber: users.paymentAccountNumber,
      paymentSignatureUrl: users.paymentSignatureUrl,
      role: users.role,
      status: users.status,
    });

  // diffFields only sees parsed.data's text fields — profilePictureUrl/
  // paymentQrCodeUrl/paymentSignatureUrl are set above from an uploaded
  // file, entirely outside parsed.data, so they need their own before/
  // after comparison or a picture-only/signature-only save would go
  // completely unlogged.
  const changedFields = [
    ...diffFields(target, parsed.data),
    ...(profilePictureUrl !== target.profilePictureUrl ? ["profilePicture"] : []),
    ...(paymentQrCodeUrl !== target.paymentQrCodeUrl ? ["paymentQrCode"] : []),
    ...(paymentSignatureUrl !== target.paymentSignatureUrl ? ["paymentSignature"] : []),
  ];
  if (changedFields.length > 0) {
    await logActivity({
      actorUserId: auth.user.id,
      action: "user.edited",
      targetType: "user",
      targetId: id,
      detail: { fields: changedFields },
    });
  }

  return NextResponse.json({ profile: updated });
}
