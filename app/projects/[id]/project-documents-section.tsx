"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FileText, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { Project, ProjectDocument } from "@/db/schema";
import type { ArDocumentInput, InvoiceDocumentInput } from "@/lib/validation/documents";
import { formatDocumentDate, formatPesoAmount } from "@/lib/documents/format";
import { isInvoiceDueSoon } from "@/lib/documents/due-soon";
import { DOCUMENT_DEFAULTS } from "@/lib/documents/defaults";
import { DocumentForm } from "./documents/[documentId]/document-form";

// prefill logic (phases-plan 3.3): title/milestone/price seed from the
// project so the create form shows them ready to go, but they're
// rendered as editable fields (DocumentForm's showPrefillFields) rather
// than hidden — the person can adjust wording for this one document
// before saving, and only a changed value is sent to the server; an
// untouched field still resolves server-side from the live project.
// Org-level payment defaults (DOCUMENT_DEFAULTS) prefill the invoice's
// payment block the same way, so it isn't retyped every time.
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyArDefaults(project: Project): ArDocumentInput & {
  title: string;
  milestone: string;
  price: string;
} {
  return {
    title: project.title,
    milestone: project.milestone,
    price: project.price,
    documentNumber: "",
    documentDate: todayIso(),
    receivedFromName: "",
    receivedFromAttention: "",
    amount: "",
    amountInWords: "",
    paymentPurpose: "",
    remainingBalance: "",
    receivedByName: DOCUMENT_DEFAULTS.receivedByName,
    receivedByTitle: DOCUMENT_DEFAULTS.receivedByTitle,
  };
}

function emptyInvoiceDefaults(project: Project): InvoiceDocumentInput & {
  title: string;
  milestone: string;
  price: string;
} {
  return {
    title: project.title,
    milestone: project.milestone,
    price: project.price,
    documentNumber: "",
    documentDate: todayIso(),
    dueDate: "",
    billedToName: "",
    billedToAttention: "",
    amount: "",
    amountInWords: "",
    paymentPurpose: "",
    agreementDate: "",
    totalProjectCost: project.price,
    paymentMethod: DOCUMENT_DEFAULTS.paymentMethod,
    paymentAccountName: DOCUMENT_DEFAULTS.paymentAccountName,
    paymentBank: DOCUMENT_DEFAULTS.paymentBank,
    paymentAccountNumber: "",
    paymentReferenceNote: `${project.title} - Milestone Payment`,
    issuedBy: DOCUMENT_DEFAULTS.issuedBy,
  };
}

export function ProjectDocumentsSection({
  project,
  initialDocuments,
  notificationDaysBefore,
}: {
  project: Project;
  initialDocuments: ProjectDocument[];
  notificationDaysBefore: number;
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [creatingType, setCreatingType] = useState<"invoice" | "ar" | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  async function handleCreate(
    data: (ArDocumentInput | InvoiceDocumentInput) & {
      title?: string;
      milestone?: string;
      price?: string;
    },
  ) {
    const type = creatingType;
    if (!type) return;
    const res = await fetch(`/api/projects/${project.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...data }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Something went wrong.");
    }
    const { document } = await res.json();
    setDocuments((prev) => [document, ...prev]);
    setCreatingType(null);
    router.push(`/projects/${project.id}/documents/${document.id}`);
  }

  return (
    <Card className="rounded-[var(--radius-lg)]">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
            Invoices &amp; Acknowledgement Receipts
          </span>
          {!creatingType && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="size-4" aria-hidden="true" />
                  Add document
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setCreatingType("invoice")}>
                  <FileText className="size-4" aria-hidden="true" />
                  Invoice
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setCreatingType("ar")}>
                  <Receipt className="size-4" aria-hidden="true" />
                  Acknowledgement Receipt
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {creatingType && (
          <div className="flex flex-col gap-4 border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-sm)] font-semibold text-[var(--foreground)]">
                New {creatingType === "ar" ? "Acknowledgement Receipt" : "Invoice"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setCreatingType(null)}>
                Cancel
              </Button>
            </div>
            <DocumentForm
              type={creatingType}
              defaultValues={
                (creatingType === "ar"
                  ? emptyArDefaults(project)
                  : emptyInvoiceDefaults(project)) as never
              }
              onSubmit={handleCreate}
              submitLabel="Create"
              showPrefillFields
            />
          </div>
        )}

        {listError && <p className="text-[var(--text-sm)] text-[var(--destructive)]">{listError}</p>}

        {documents.length === 0 && !creatingType ? (
          <p className="py-4 text-center text-[var(--text-sm)] text-[var(--muted-foreground)]">
            No invoices or acknowledgement receipts yet.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {documents.map((document) => {
              const isUploaded = !!document.fileUrl;
              const href = isUploaded
                ? document.fileUrl!
                : `/projects/${project.id}/documents/${document.id}`;
              return (
                <Link
                  key={document.id}
                  href={href}
                  target={isUploaded ? "_blank" : undefined}
                  rel={isUploaded ? "noreferrer" : undefined}
                  className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0 hover:bg-[var(--muted)]"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-[var(--text-base)] text-[var(--foreground)]">
                      {document.type === "ar" ? "Acknowledgement Receipt" : "Invoice"}
                      {document.documentNumber && (
                        <span className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
                          {document.documentNumber}
                        </span>
                      )}
                      {document.type === "invoice" && (
                        <Badge variant={document.isPaid ? "success" : "outline"}>
                          {document.isPaid ? "Paid" : "Unpaid"}
                        </Badge>
                      )}
                      {isInvoiceDueSoon({
                        type: document.type,
                        isPaid: document.isPaid,
                        dueDate: document.dueDate,
                        notificationDaysBefore,
                      }) && <Badge variant="destructive">Due soon</Badge>}
                    </span>
                    <span className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
                      {document.documentDate ? formatDocumentDate(document.documentDate) : ""}
                    </span>
                  </div>
                  {document.amount && (
                    <span className="text-[var(--text-base)] font-semibold text-[var(--foreground)]">
                      ₱{formatPesoAmount(document.amount)}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
