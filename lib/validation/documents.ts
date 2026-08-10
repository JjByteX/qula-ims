import { z } from "zod";

const moneyString = z
  .string()
  .trim()
  .min(1, "Amount is required")
  .refine((val) => !Number.isNaN(Number(val)), "Enter a valid amount")
  .refine((val) => Number(val) >= 0, "Amount cannot be negative");

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

// Acknowledgement Receipt (phases-plan 3.2). Mirrors the client's real AR
// template field for field: received from (company + contact), project,
// amount received (+ words), payment purpose, and the two signature-block
// names. receivedBySignatureUrl (Phase 16) isn't part of this text-field
// schema — same reasoning as invoice's signatureUrl/qrCodeUrl below: it's
// a snapshotted image URL set by auto-fill/refresh
// (app/api/projects/[id]/documents/route.ts and .../refresh/route.ts),
// not a value someone types into the create/edit form.
//
// documentNumber and remainingBalance are deliberately NOT in this
// schema anymore. documentNumber is generated server-side, once, at
// creation (lib/documents/numbering.ts) and never editable afterward —
// same "fixed once issued" rule the rest of a document's identity
// follows. remainingBalance is always derived (lib/documents/balance.ts:
// sum of all milestone prices minus sum of milestones already "done")
// and recomputed on every create/PATCH/refresh rather than accepted from
// the request, so it can never drift out of sync with the project's
// actual milestones.
export const arDocumentSchema = z.object({
  documentDate: dateString,
  receivedFromName: z.string().trim().min(1, "Received from is required"),
  receivedFromAttention: z.string().trim().optional(),
  amount: moneyString,
  amountInWords: z.string().trim().min(1, "Amount in words is required"),
  paymentPurpose: z.string().trim().min(1, "Payment purpose is required"),
  receivedByName: z.string().trim().min(1, "Received by is required"),
  receivedByTitle: z.string().trim().min(1, "Title is required"),
});

export type ArDocumentInput = z.infer<typeof arDocumentSchema>;

// Invoice (phases-plan 3.2). Mirrors the client's real invoice template:
// billed-to, due date, amount due (+ words), payment purpose, the
// agreement/total-cost reference line, and the InstaPay payment block.
// signatureUrl/qrCodeUrl are snapshotted image URLs set by auto-fill/
// refresh (app/api/projects/[id]/documents/route.ts and
// .../refresh/route.ts), not part of this text-field schema.
export const invoiceDocumentSchema = z.object({
  documentNumber: z.string().trim().min(1, "Invoice number is required"),
  documentDate: dateString,
  dueDate: dateString,
  billedToName: z.string().trim().min(1, "Billed to is required"),
  billedToAttention: z.string().trim().optional(),
  amount: moneyString,
  amountInWords: z.string().trim().min(1, "Amount in words is required"),
  paymentPurpose: z.string().trim().min(1, "Payment purpose is required"),
  agreementDate: dateString,
  totalProjectCost: moneyString,
  paymentMethod: z.string().trim().min(1, "Payment method is required"),
  paymentAccountName: z.string().trim().min(1, "Account name is required"),
  paymentBank: z.string().trim().min(1, "Bank is required"),
  paymentAccountNumber: z.string().trim().min(1, "Account number is required"),
  issuedBy: z.string().trim().min(1, "Issued by is required"),
});

export type InvoiceDocumentInput = z.infer<typeof invoiceDocumentSchema>;

// Prefill override (phases-plan 3.3, revised for multi-milestone projects).
// milestoneId picks which milestone this document bills — required, since
// a project can now have several. title/milestone/price still prefill from
// that milestone (and the project, for title) but the person can edit the
// wording before saving — e.g. slightly different phrasing for this
// particular invoice than what's currently on the milestone record. Text
// fields are optional: when omitted, the create route falls back to the
// live milestone's/project's value. Deliberately separate from
// arDocumentSchema/invoiceDocumentSchema (rather than folded in) so
// PATCH/edit — which reuses those two schemas — never accepts a
// title/milestone/price/milestoneId change; retitling or rebilling an
// issued document is out of scope here.
export const documentPrefillOverrideSchema = z.object({
  milestoneId: z.string().uuid("Select a milestone"),
  title: z.string().trim().min(1, "Title is required").optional(),
  milestone: z.string().trim().min(1, "Milestone is required").optional(),
  price: z
    .string()
    .trim()
    .min(1, "Price is required")
    .refine((val) => !Number.isNaN(Number(val)), "Enter a valid price")
    .refine((val) => Number(val) >= 0, "Price cannot be negative")
    .optional(),
});

export type DocumentPrefillOverrideInput = z.infer<typeof documentPrefillOverrideSchema>;
