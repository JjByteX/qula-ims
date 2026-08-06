import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/db/client";
import { projectDocuments } from "@/db/schema";
import { AcknowledgementReceiptView } from "./acknowledgement-receipt-view";
import { InvoiceView } from "./invoice-view";
import { DocumentToolbar } from "./document-toolbar";

// Rendered view for a generated invoice or AR (phases-plan 3.2). Uploaded
// documents (fileUrl set) don't have a page here — they're just a link to
// the stored file, shown inline on the project page instead.
export default async function ProjectDocumentPage({
  params,
}: {
  params: Promise<{ id: string; documentId: string }>;
}) {
  await requireUser();
  const { id: projectId, documentId } = await params;

  const [document] = await db
    .select()
    .from(projectDocuments)
    .where(eq(projectDocuments.id, documentId))
    .limit(1);

  if (!document || document.projectId !== projectId) {
    notFound();
  }
  if (document.fileUrl) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[var(--muted)] px-4 py-10">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
        <DocumentToolbar projectId={projectId} document={document} />
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-sm">
          {document.type === "ar" ? (
            <AcknowledgementReceiptView document={document} />
          ) : (
            <InvoiceView document={document} />
          )}
        </div>
      </div>
    </main>
  );
}
