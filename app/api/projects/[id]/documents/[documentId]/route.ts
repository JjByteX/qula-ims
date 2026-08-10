import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projectDocuments } from "@/db/schema";
import { arDocumentSchema, invoiceDocumentSchema } from "@/lib/validation/documents";
import { authorizeUser } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/activity/log";
import { diffFields } from "@/lib/activity/diff";
import { computeArRemainingBalance } from "@/lib/documents/balance";

// Edits a generated document's fields (phases-plan 3.2). isPaid is a
// separate toggle endpoint (phases-plan 3.4), not part of this general
// edit, so accidentally resubmitting the edit form can't flip payment
// status as a side effect.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id: projectId, documentId } = await params;

  const [existing] = await db
    .select()
    .from(projectDocuments)
    .where(eq(projectDocuments.id, documentId))
    .limit(1);
  if (!existing || existing.projectId !== projectId) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const schema = existing.type === "ar" ? arDocumentSchema : invoiceDocumentSchema;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // remainingBalance isn't part of arDocumentSchema anymore (it's always
  // derived, lib/documents/balance.ts) so it never arrives in
  // parsed.data — recomputed here on every AR save instead, since an
  // edit elsewhere on the project (e.g. a milestone price change) could
  // change what it should be even if this document's own fields didn't.
  // documentNumber similarly isn't in the schema, so it's simply absent
  // from parsed.data and the existing value on the row is left alone.
  const derivedFields: Record<string, string> = {};
  if (existing.type === "ar") {
    derivedFields.remainingBalance = await computeArRemainingBalance(
      projectId,
      existing.milestoneId,
    );
  }

  const [updated] = await db
    .update(projectDocuments)
    .set({ ...parsed.data, ...derivedFields, updatedAt: new Date() })
    .where(eq(projectDocuments.id, documentId))
    .returning();

  const changedFields = diffFields(existing, parsed.data);
  if (changedFields.length > 0) {
    await logActivity({
      actorUserId: auth.user.id,
      action: existing.type === "ar" ? "ar.edited" : "invoice.edited",
      targetType: "document",
      targetId: documentId,
      detail: { projectId, fields: changedFields },
    });
  }

  return NextResponse.json({ document: updated });
}
