import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projectDocuments } from "@/db/schema";
import { authorizeUser } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/activity/log";
import { getDesignatedPayer, getInvoicePayerFields, getArPayerFields } from "@/lib/documents/payer-fields";

// Refresh (docs/phases-plan-revision-2.md Phase 16): re-applies today's
// date and the *currently* designated payer's fields onto an existing
// document, in place — same auto-fill this document would have gotten if
// created fresh today, without actually creating a new row. This is for
// the case where the payer changed (a different person picked on the
// Settings radio, or the same payer updated their payment info/signature/
// QR after this document was first generated) and the existing
// invoice/AR should catch up to that, rather than staying frozen with
// whatever was true at creation time — the one deliberate exception to
// the snapshot-at-creation rule every other auto-filled field follows.
//
// Fields touched, by type:
// - Both: documentDate (today).
// - Invoice: paymentMethod/paymentAccountName/paymentBank/
//   paymentAccountNumber/signatureUrl/qrCodeUrl/issuedBy.
// - AR: receivedByName/receivedByTitle/receivedBySignatureUrl.
// Everything else on the document (Billed To/Received From, amount,
// milestone, Payment Purpose, document number) is untouched — those
// aren't payer-profile fields, refreshing shouldn't reach them. This is
// a deliberately narrower operation than the general PATCH edit
// (.../[documentId]/route.ts): a fixed, known set of fields, not
// whatever the request body happens to send.
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

  const designatedPayer = await getDesignatedPayer();
  const todayIso = new Date().toISOString().slice(0, 10);
  const refreshed: Record<string, string> = { documentDate: todayIso };

  if (document.type === "invoice") {
    Object.assign(refreshed, await getInvoicePayerFields(designatedPayer));
  } else {
    Object.assign(refreshed, getArPayerFields(designatedPayer));
  }

  const [updated] = await db
    .update(projectDocuments)
    .set({ ...refreshed, updatedAt: new Date() })
    .where(eq(projectDocuments.id, documentId))
    .returning();

  await logActivity({
    actorUserId: auth.user.id,
    action: document.type === "ar" ? "ar.refreshed" : "invoice.refreshed",
    targetType: "document",
    targetId: documentId,
    detail: { projectId, fields: Object.keys(refreshed) },
  });

  return NextResponse.json({ document: updated });
}
