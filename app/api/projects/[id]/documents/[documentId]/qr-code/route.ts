import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projectDocuments } from "@/db/schema";
import { authorizeUser } from "@/lib/auth/authorize";
import { StorageValidationError, uploadInvoiceQrCode, deleteFile } from "@/lib/storage";
import { logActivity } from "@/lib/activity/log";

// Uploads (or replaces) the QR code image shown on an invoice. Only
// meaningful for type = "invoice" — ARs don't have a QR code in the
// client's template.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id: projectId, documentId } = await params;

  const [document] = await db
    .select()
    .from(projectDocuments)
    .where(eq(projectDocuments.id, documentId))
    .limit(1);
  if (!document || document.projectId !== projectId) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  if (document.type !== "invoice") {
    return NextResponse.json({ error: "Only invoices can have a QR code." }, { status: 400 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }

  let uploaded;
  try {
    uploaded = await uploadInvoiceQrCode({ documentId, file });
  } catch (error) {
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  // Best-effort cleanup of the previous QR image — a failed delete here
  // shouldn't block the new upload from taking effect, it just leaves an
  // orphaned object in the bucket.
  const previousUrl = document.qrCodeUrl;

  const [updated] = await db
    .update(projectDocuments)
    .set({ qrCodeUrl: uploaded.url, updatedAt: new Date() })
    .where(eq(projectDocuments.id, documentId))
    .returning();

  if (previousUrl) {
    const previousKey = previousUrl.split("/").slice(3).join("/");
    await deleteFile(previousKey).catch(() => {});
  }

  await logActivity({
    actorUserId: auth.user.id,
    action: "invoice.edited",
    targetType: "document",
    targetId: documentId,
    detail: { projectId, fields: ["qrCodeUrl"] },
  });

  return NextResponse.json({ document: updated });
}
