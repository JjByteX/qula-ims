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
// amount received (+ words), payment purpose, remaining balance, and the
// two signature-block names.
export const arDocumentSchema = z.object({
  documentNumber: z.string().trim().min(1, "Receipt number is required"),
  documentDate: dateString,
  receivedFromName: z.string().trim().min(1, "Received from is required"),
  receivedFromAttention: z.string().trim().optional(),
  amount: moneyString,
  amountInWords: z.string().trim().min(1, "Amount in words is required"),
  paymentPurpose: z.string().trim().min(1, "Payment purpose is required"),
  remainingBalance: moneyString,
  receivedByName: z.string().trim().min(1, "Received by is required"),
  receivedByTitle: z.string().trim().min(1, "Title is required"),
});

export type ArDocumentInput = z.infer<typeof arDocumentSchema>;

// Invoice (phases-plan 3.2). Mirrors the client's real invoice template:
// billed-to, due date, amount due (+ words), payment purpose, the
// agreement/total-cost reference line, and the InstaPay payment block.
// qrCodeUrl is uploaded separately (see app/api/project-documents/[id]/qr-code/route.ts)
// and isn't part of this text-field schema.
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
  paymentReferenceNote: z.string().trim().min(1, "Reference note is required"),
  issuedBy: z.string().trim().min(1, "Issued by is required"),
});

export type InvoiceDocumentInput = z.infer<typeof invoiceDocumentSchema>;

// Prefill override (phases-plan 3.3): title/milestone/price are prefilled
// from the project when creating a document, but the person can edit them
// before saving — e.g. a slightly different milestone wording for this
// particular invoice than what's currently on the project record. All
// optional: when a field is omitted, the create route falls back to the
// live project's value, so this never blocks a create that doesn't touch
// them. Deliberately separate from arDocumentSchema/invoiceDocumentSchema
// (rather than folded in) so PATCH/edit — which reuses those two schemas —
// never accepts a title/milestone/price change; retitling an issued
// document is out of scope here.
export const documentPrefillOverrideSchema = z.object({
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
