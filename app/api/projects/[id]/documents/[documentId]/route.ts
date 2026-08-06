import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projectDocuments } from "@/db/schema";
import { arDocumentSchema, invoiceDocumentSchema } from "@/lib/validation/documents";
import { authorizeUser } from "@/lib/auth/authorize";

// Edits a generated document's fields (phases-plan 3.2). isPaid is a
// separate toggle endpoint (phases-plan 3.4), not part of this general
// edit, so accidentally resubmitting the edit form can't flip payment
// status as a side effect.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id: projectId, documentId } = await params;

  const [existing] = await db
    .select()
    .from(projectDocuments)
    .where(eq(projectDocuments.id, documentId))
    .limit(1);
  if (!existing || existing.projectId !== projectId) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const schema = existing.type === "ar" ? arDocumentSchema : invoiceDocumentSchema;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const [updated] = await db
    .update(projectDocuments)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(projectDocuments.id, documentId))
    .returning();

  return NextResponse.json({ document: updated });
}
