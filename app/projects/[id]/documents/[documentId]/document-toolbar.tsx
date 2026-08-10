"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, Pencil, RefreshCw, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useMilestonesDialog } from "@/app/projects/milestones-dialog";
import type { ProjectDocument } from "@/db/schema";
import styles from "./document.module.css";

// Toolbar for the generated-document view (phases-plan 3.2). Wrapped in
// styles.noPrint so none of this shows up when the person actually
// prints or saves the document as PDF — window.print() is the export
// mechanism here rather than a generated-PDF endpoint, since the whole
// point of this view is to already look exactly like the printed page.
//
// No QR code upload here (docs/phases-plan-revision-2.md Phase 15
// removed it) — a new invoice's QR code is now snapshotted automatically
// from the designated payer's own payment profile (Settings > "Who
// receives payment"), the same way the signature already was. Uploading
// one per document was a second, redundant place to set the same image.
//
// No manual "Mark as paid" button here either — Client-Requests.md: an
// invoice is paid once its acknowledgement receipt exists, so creating
// the AR is what marks the invoice paid now (POST
// .../documents/route.ts, in the `type === "ar"` branch), not a
// separate toggle someone has to remember to click. isPaid is still a
// real column (still drives the Paid/Unpaid badge in
// project-documents-section.tsx and the dashboard's unpaid-invoice
// flag) — it's just no longer settable from here.
//
// Refresh (Phase 16): re-applies today's date and the currently
// designated payer's fields onto this document in place — for when the
// payer changed, or the same payer updated their payment info/signature/
// QR, after this document was first generated. Confirmed with a dialog
// first since it overwrites whatever payer info is currently on the
// document (POST .../refresh/route.ts has the full field list touched).
export function DocumentToolbar({
  projectId,
  document,
}: {
  projectId: string;
  document: ProjectDocument;
}) {
  const router = useRouter();
  const { openProject } = useMilestonesDialog();
  const [isRefreshDialogOpen, setIsRefreshDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  async function handleRefresh() {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/documents/${document.id}/refresh`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setRefreshError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      setIsRefreshDialogOpen(false);
      router.refresh();
    } catch {
      setRefreshError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsRefreshing(false);
    }
  }

  const refreshFieldsDescription =
    document.type === "invoice"
      ? "the date, payment method, account name, bank, account number, signature, and QR code"
      : "the date, received-by name, title, and signature";

  return (
    <div className={`${styles.noPrint} flex flex-col gap-2`}>
      <div className="flex items-center justify-between gap-2">
        {/* Two things, not one: router.back() actually leaves this page
            (so the URL/page underneath the popup goes back to wherever
            the project was opened from — dashboard, projects list,
            notification menu), and openProject(projectId) tells the
            popup to be open once we land. Calling openProject alone (as
            this used to) only sets the popup's open state — it never
            navigates, so the invoice page stayed put underneath it. The
            two calls are safe together because MilestonesDialogProvider
            lives in the root layout, which never unmounts across
            client-side navigation — its state (and therefore the open
            popup) survives the back() transition intact. */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            openProject(projectId);
            router.back();
          }}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshError(null);
              setIsRefreshDialogOpen(true);
            }}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/projects/${projectId}/documents/${document.id}/edit`)}
          >
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" />
            Print
          </Button>
        </div>
      </div>

      <Dialog open={isRefreshDialogOpen} onOpenChange={setIsRefreshDialogOpen}>
        <DialogContent className="max-w-[480px] p-6">
          <DialogTitle>Refresh this {document.type === "invoice" ? "invoice" : "receipt"}?</DialogTitle>
          <DialogDescription>
            This updates {refreshFieldsDescription} to match whoever is currently selected as
            the designated payer in Settings. It replaces whatever is currently on this
            document — the Billed To/Received From info, amount, milestone, and payment
            purpose are not affected.
          </DialogDescription>
          {refreshError && (
            <p className="text-[var(--text-sm)] text-[var(--destructive)]">{refreshError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRefreshDialogOpen(false)}
              disabled={isRefreshing}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
