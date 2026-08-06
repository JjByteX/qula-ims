import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/db/client";
import { projectDocuments } from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { EditDocumentForm } from "./edit-document-form";

export default async function EditProjectDocumentPage({
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

  if (!document || document.projectId !== projectId || document.fileUrl) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-[var(--text-xl)] font-semibold text-[var(--foreground)]">
            Edit {document.type === "ar" ? "Acknowledgement Receipt" : "Invoice"}
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">{document.title}</p>
        </div>

        <Card>
          <CardContent>
            <EditDocumentForm projectId={projectId} document={document} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
