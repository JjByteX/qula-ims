import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getOrCreateAppSettings } from "@/lib/settings/get";
import { getIssuedByLine } from "@/lib/documents/signatories";

// Looks up the currently designated payer (Settings > "Who receives
// payment", Phase 12.3), or undefined if none is set. Shared by document
// creation (app/api/projects/[id]/documents/route.ts) and the Refresh
// action (.../[documentId]/refresh/route.ts) so both read the exact same
// "who's the payer right now" answer — there's only ever one correct
// answer to that question at a given moment, no reason for two lookups
// that could theoretically disagree.
export async function getDesignatedPayer(): Promise<typeof users.$inferSelect | undefined> {
  const appSettings = await getOrCreateAppSettings();
  if (!appSettings.designatedPayerUserId) return undefined;

  const [payer] = await db
    .select()
    .from(users)
    .where(eq(users.id, appSettings.designatedPayerUserId))
    .limit(1);
  return payer;
}

// Payer-linked fields for an invoice (docs/phases-plan-revision-2.md
// Phase 14/15, following on from Phase 12.4): payment method/account/
// bank/number, signature, QR code, and the issuedBy signatory line. Only
// includes keys the payer's profile actually has a value for — same
// "leave it out rather than overwrite with blank" rule create-time
// auto-fill already follows elsewhere, so a payer with an incomplete
// profile doesn't blank out fields that had something in them before.
export async function getInvoicePayerFields(
  designatedPayer: typeof users.$inferSelect | undefined,
): Promise<Record<string, string>> {
  const fields: Record<string, string> = {};
  if (designatedPayer?.paymentMethod) fields.paymentMethod = designatedPayer.paymentMethod;
  if (designatedPayer?.paymentAccountName) {
    fields.paymentAccountName = designatedPayer.paymentAccountName;
  }
  if (designatedPayer?.paymentBank) fields.paymentBank = designatedPayer.paymentBank;
  if (designatedPayer?.paymentAccountNumber) {
    fields.paymentAccountNumber = designatedPayer.paymentAccountNumber;
  }
  if (designatedPayer?.paymentSignatureUrl) {
    fields.signatureUrl = designatedPayer.paymentSignatureUrl;
  }
  if (designatedPayer?.paymentQrCodeUrl) fields.qrCodeUrl = designatedPayer.paymentQrCodeUrl;

  // "Project Lead" is a fixed suffix text (Phase 11's getIssuedByLine())
  // — what Phase 12 actually supplies is *whether* to append it: once a
  // designated payer exists, the signatory line ends in that title;
  // until then it falls back to just the joined active-user names with
  // no suffix. Always set (never conditionally skipped like the fields
  // above) since getIssuedByLine() always returns a usable string even
  // with no payer.
  fields.issuedBy = await getIssuedByLine(designatedPayer ? "Project Lead" : undefined);

  return fields;
}

// Payer-linked fields for an AR (docs/phases-plan-revision-2.md Phase
// 16): receivedByName/receivedByTitle/receivedBySignatureUrl now come
// from the one specific person selected as designated payer, the same
// live link invoices already had — not the static DOCUMENT_DEFAULTS
// name ARs used to fall back to. Unlike invoice's issuedBy (which joins
// every active user), an AR's "received by" is one specific signatory,
// so this uses the payer's own name directly rather than
// getIssuedByLine()'s multi-user join.
export function getArPayerFields(
  designatedPayer: typeof users.$inferSelect | undefined,
): Record<string, string> {
  if (!designatedPayer) return {};

  const fields: Record<string, string> = {
    receivedByName: `${designatedPayer.firstName} ${designatedPayer.lastName}`.trim(),
    receivedByTitle: "Project Lead",
  };
  if (designatedPayer.paymentSignatureUrl) {
    fields.receivedBySignatureUrl = designatedPayer.paymentSignatureUrl;
  }
  return fields;
}
