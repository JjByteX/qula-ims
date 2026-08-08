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
import type { Milestone, Project, ProjectDocument } from "@/db/schema";
import type { ArDocumentInput, InvoiceDocumentInput } from "@/lib/validation/documents";
import { formatDocumentDate, formatPesoAmount } from "@/lib/documents/format";
import { isInvoiceDueSoon } from "@/lib/documents/due-soon";
import { DOCUMENT_DEFAULTS } from "@/lib/documents/defaults";
import { amountToWords } from "@/lib/documents/amount-to-words";
import { DocumentForm } from "./documents/[documentId]/document-form";

// prefill logic (phases-plan 3.3, revised for multi-milestone projects;
// full auto-fill per phases-plan-revision-1.md Phase 9): title/milestone/
// price/amount/amountInWords/paymentPurpose all seed from the project +
// the milestone the person picked, so the create form shows them ready to
// go with nothing left blank that the milestone already answers — but
// they're rendered as editable fields (DocumentForm's showPrefillFields)
// rather than hidden, so the person can still adjust wording for this one
// document before saving. billedToName/billedToAttention prefer the
// project's own billing default (Phase 8) when set. Payment-block fields
// (method/account/bank) fall back to the org-wide DOCUMENT_DEFAULTS —
// projects no longer carry their own copy of payment info
// (docs/phases-plan-revision-2.md Phase 14 removed those columns; that
// info now lives on the designated payer's user profile instead, read
// server-side, which this client-side dead-code path can't do — see the
// issuedBy note below for the same reasoning).
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyArDefaults(
  project: Project,
  milestone: Milestone,
): ArDocumentInput & {
  title: string;
  milestone: string;
  price: string;
} {
  return {
    title: project.title,
    milestone: milestone.title,
    price: milestone.price,
    documentNumber: "",
    documentDate: todayIso(),
    receivedFromName: project.billedToName ?? "",
    receivedFromAttention: project.billedToAttention ?? "",
    amount: milestone.price,
    amountInWords: amountToWords(milestone.price),
    paymentPurpose: milestone.title,
    remainingBalance: "",
    receivedByName: DOCUMENT_DEFAULTS.receivedByName,
    receivedByTitle: DOCUMENT_DEFAULTS.receivedByTitle,
  };
}

function emptyInvoiceDefaults(
  project: Project,
  milestone: Milestone,
  allMilestones: Milestone[],
): InvoiceDocumentInput & {
  title: string;
  milestone: string;
  price: string;
} {
  const totalProjectCost = allMilestones
    .reduce((sum, m) => sum + Number(m.price), 0)
    .toFixed(2);

  return {
    title: project.title,
    milestone: milestone.title,
    price: milestone.price,
    documentNumber: "",
    documentDate: todayIso(),
    dueDate: todayIso(),
    billedToName: project.billedToName ?? "",
    billedToAttention: project.billedToAttention ?? "",
    amount: milestone.price,
    amountInWords: amountToWords(milestone.price),
    paymentPurpose: milestone.title,
    agreementDate: todayIso(),
    totalProjectCost,
    paymentMethod: DOCUMENT_DEFAULTS.paymentMethod,
    paymentAccountName: DOCUMENT_DEFAULTS.paymentAccountName,
    paymentBank: DOCUMENT_DEFAULTS.paymentBank,
    paymentAccountNumber: "",
    // issuedBy is derived server-side from active users (Phase 11's
    // getIssuedByLine(), lib/documents/signatories.ts) — that's an async
    // DB call, so it can't run in this client-side default-builder. This
    // component's form isn't currently wired into any route (see the
    // milestones-section.tsx comment: creation goes through the 3-dot
    // menu's create-then-open flow, not an inline form here), so an
    // empty starting value is fine; the real prefill happens in
    // app/api/projects/[id]/documents/route.ts.
    issuedBy: "",
  };
}

export function ProjectDocumentsSection({
  project,
  milestones,
  initialDocuments,
  notificationDaysBefore,
}: {
  project: Project;
  milestones: Milestone[];
  initialDocuments: ProjectDocument[];
  notificationDaysBefore: number;
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [pendingMilestoneId, setPendingMilestoneId] = useState<string | null>(null);
  const [creatingType, setCreatingType] = useState<"invoice" | "ar" | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const pendingMilestone = milestones.find((m) => m.id === pendingMilestoneId) ?? null;

  function milestoneTitleFor(document: ProjectDocument): string {
    return milestones.find((m) => m.id === document.milestoneId)?.title ?? document.milestone;
  }

  async function handleCreate(
    data: (ArDocumentInput | InvoiceDocumentInput) & {
      title?: string;
      milestone?: string;
      price?: string;
    },
  ) {
    const type = creatingType;
    if (!type || !pendingMilestoneId) return;
    const res = await fetch(`/api/projects/${project.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, milestoneId: pendingMilestoneId, ...data }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Something went wrong.");
    }
    const { document } = await res.json();
    setDocuments((prev) => [document, ...prev]);
    setCreatingType(null);
    setPendingMilestoneId(null);
    router.push(`/projects/${project.id}/documents/${document.id}`);
  }

  return (
    <Card className="rounded-[var(--radius-lg)]">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
            Invoices &amp; Acknowledgement Receipts
          </span>
          {!creatingType && milestones.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="size-4" aria-hidden="true" />
                  Add document
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {milestones.map((milestone) => (
                  <DropdownMenuItem
                    key={milestone.id}
                    onSelect={() => setPendingMilestoneId(milestone.id)}
                  >
                    {milestone.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {pendingMilestoneId && !creatingType && (
          <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4">
            <span className="text-[var(--text-sm)] font-semibold text-[var(--foreground)]">
              New document for &quot;{pendingMilestone?.title}&quot; — choose a type
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCreatingType("invoice")}>
                <FileText className="size-4" aria-hidden="true" />
                Invoice
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCreatingType("ar")}>
                <Receipt className="size-4" aria-hidden="true" />
                Acknowledgement Receipt
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPendingMilestoneId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {creatingType && pendingMilestone && (
          <div className="flex flex-col gap-4 border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-sm)] font-semibold text-[var(--foreground)]">
                New {creatingType === "ar" ? "Acknowledgement Receipt" : "Invoice"} — {pendingMilestone.title}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCreatingType(null);
                  setPendingMilestoneId(null);
                }}
              >
                Cancel
              </Button>
            </div>
            <DocumentForm
              type={creatingType}
              defaultValues={
                (creatingType === "ar"
                  ? emptyArDefaults(project, pendingMilestone)
                  : emptyInvoiceDefaults(project, pendingMilestone, milestones)) as never
              }
              onSubmit={handleCreate}
              submitLabel="Create"
              showPrefillFields
            />
          </div>
        )}

        {listError && <p className="text-[var(--text-sm)] text-[var(--destructive)]">{listError}</p>}

        {milestones.length === 0 && (
          <p className="py-4 text-center text-[var(--text-sm)] text-[var(--muted-foreground)]">
            Add a milestone above before creating an invoice or AR.
          </p>
        )}

        {documents.length === 0 && !creatingType && milestones.length > 0 ? (
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
                      {milestoneTitleFor(document)}
                      {document.documentDate ? ` · ${formatDocumentDate(document.documentDate)}` : ""}
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
