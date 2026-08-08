// Fixed defaults for generated invoices and ARs, matching the client's
// real templates exactly (payment details, received-by line). These
// rarely change, so they're a single constant to edit here rather than
// something every new document has to be retyped with — the create form
// pre-fills from these but leaves every field editable per document.
//
// issuedBy is NOT here — it's derived live from the users table
// (lib/documents/signatories.ts's getIssuedByLine(), Phase 11) instead
// of being a hand-typed string, so the signatory line stays in sync
// with who's actually an active user without editing this file.
export const DOCUMENT_DEFAULTS = {
  paymentMethod: "InstaPay",
  paymentAccountName: "Rasty Espartero",
  paymentBank: "MariBank",
  paymentReceivedByLine:
    "Payment is received by Rasty Cannu Espartero on behalf of the Service Providers named in the Agreement.",
  receivedByName: "Espartero, Rasty",
  receivedByTitle: "Project Lead",
} as const;
