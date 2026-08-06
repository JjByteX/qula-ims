"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, Pencil, Upload, CircleCheck, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectDocument } from "@/db/schema";
import styles from "./document.module.css";

// Toolbar for the generated-document view (phases-plan 3.2). Wrapped in
// styles.noPrint so none of this shows up when the person actually
// prints or saves the document as PDF — window.print() is the export
// mechanism here rather than a generated-PDF endpoint, since the whole
// point of this view is to already look exactly like the printed page.
export function DocumentToolbar({
  projectId,
  document,
}: {
  projectId: string;
  document: ProjectDocument;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isTogglingPaid, setIsTogglingPaid] = useState(false);
  const [paidError, setPaidError] = useState<string | null>(null);

  async function handleQrCodeUpload(file: File) {
    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/documents/${document.id}/qr-code`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setUploadError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setUploadError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsUploading(false);
    }
  }

  // Status tracking (phases-plan 3.4): one endpoint per direction
  // (mark-paid / mark-unpaid), matching the archive/unarchive pattern —
  // see those routes for why.
  async function handleTogglePaid() {
    setIsTogglingPaid(true);
    setPaidError(null);
    try {
      const action = document.isPaid ? "mark-unpaid" : "mark-paid";
      const res = await fetch(
        `/api/projects/${projectId}/documents/${document.id}/${action}`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setPaidError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setPaidError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsTogglingPaid(false);
    }
  }

  return (
    <div className={`${styles.noPrint} flex flex-col gap-2`}>
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => router.push(`/projects/${projectId}`)}>
          Back to project
        </Button>
        <div className="flex items-center gap-2">
          {document.type === "invoice" && (
            <>
              <Button
                variant={document.isPaid ? "outline" : "default"}
                size="sm"
                onClick={handleTogglePaid}
                disabled={isTogglingPaid}
              >
                {document.isPaid ? (
                  <CircleX className="size-4" aria-hidden="true" />
                ) : (
                  <CircleCheck className="size-4" aria-hidden="true" />
                )}
                {isTogglingPaid
                  ? "Updating..."
                  : document.isPaid
                    ? "Mark unpaid"
                    : "Mark as paid"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleQrCodeUpload(file);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload className="size-4" aria-hidden="true" />
                {isUploading ? "Uploading..." : document.qrCodeUrl ? "Replace QR code" : "Upload QR code"}
              </Button>
            </>
          )}
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
            Print / Save as PDF
          </Button>
        </div>
      </div>
      {uploadError && (
        <p className="text-[var(--text-sm)] text-[var(--destructive)]">{uploadError}</p>
      )}
      {paidError && (
        <p className="text-[var(--text-sm)] text-[var(--destructive)]">{paidError}</p>
      )}
    </div>
  );
}
