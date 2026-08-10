"use client";

import { useRouter } from "next/navigation";
import type { ProjectDocument } from "@/db/schema";
import type { ArDocumentInput, InvoiceDocumentInput } from "@/lib/validation/documents";
import { DocumentForm } from "../document-form";

// Converts nullable DB columns to the string defaults react-hook-form
// expects, and only sends the fields the document's type schema covers.
// documentNumber (both types) and remainingBalance (AR) are no longer
// part of this — documentNumber is generated once server-side and never
// edited (lib/documents/numbering.ts), and remainingBalance is always
// recomputed server-side (lib/documents/balance.ts), so neither belongs
// in a form default anymore.
function toDefaultValues(document: ProjectDocument) {
  const shared = {
    documentDate: document.documentDate ?? "",
    amount: document.amount ?? "",
    amountInWords: document.amountInWords ?? "",
    paymentPurpose: document.paymentPurpose ?? "",
  };

  if (document.type === "ar") {
    return {
      ...shared,
      receivedFromName: document.receivedFromName ?? "",
      receivedFromAttention: document.receivedFromAttention ?? "",
      receivedByName: document.receivedByName ?? "",
      receivedByTitle: document.receivedByTitle ?? "",
    };
  }

  return {
    ...shared,
    dueDate: document.dueDate ?? "",
    billedToName: document.billedToName ?? "",
    billedToAttention: document.billedToAttention ?? "",
    agreementDate: document.agreementDate ?? "",
    totalProjectCost: document.totalProjectCost ?? "",
    paymentMethod: document.paymentMethod ?? "",
    paymentAccountName: document.paymentAccountName ?? "",
    paymentBank: document.paymentBank ?? "",
    paymentAccountNumber: document.paymentAccountNumber ?? "",
    issuedBy: document.issuedBy ?? "",
    // receivedFromName/receivedByName/etc are AR-only; DocumentForm's
    // shared type just wants the keys present so RHF doesn't warn about
    // an uncontrolled->controlled switch.
    receivedFromName: "",
    receivedFromAttention: "",
    receivedByName: "",
    receivedByTitle: "",
  };
}

export function EditDocumentForm({
  projectId,
  document,
}: {
  projectId: string;
  document: ProjectDocument;
}) {
  const router = useRouter();

  async function handleSubmit(
    data: (ArDocumentInput | InvoiceDocumentInput) & {
      title?: string;
      milestone?: string;
      price?: string;
    },
  ) {
    const res = await fetch(`/api/projects/${projectId}/documents/${document.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error("Failed to save document");
    }
    router.push(`/projects/${projectId}/documents/${document.id}`);
    router.refresh();
  }

  return (
    <DocumentForm
      type={document.type}
      defaultValues={toDefaultValues(document) as never}
      onSubmit={handleSubmit}
      submitLabel="Save changes"
    />
  );
}
