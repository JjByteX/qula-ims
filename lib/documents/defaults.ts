// Fixed defaults for generated invoices and ARs, matching the client's
// real templates exactly (payment details, signatories). These rarely
// change, so they're a single constant to edit here rather than
// something every new document has to be retyped with — the create form
// pre-fills from these but leaves every field editable per document.
export const DOCUMENT_DEFAULTS = {
  paymentMethod: "InstaPay",
  paymentAccountName: "Rasty Espartero",
  paymentBank: "MariBank",
  issuedBy: "Ejay Gonzales Eduardo II, Jj Sanchez Bassig, Rasty Cannu Espartero, Project Lead",
  paymentReceivedByLine:
    "Payment is received by Rasty Cannu Espartero on behalf of the Service Providers named in the Agreement.",
  receivedByName: "Espartero, Rasty",
  receivedByTitle: "Project Lead",
} as const;
