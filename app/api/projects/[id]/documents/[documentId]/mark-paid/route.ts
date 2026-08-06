import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projectDocuments } from "@/db/schema";
import { authorizeUser } from "@/lib/auth/authorize";

// Paid/unpaid toggle (phases-plan 3.4), split into two focused endpoints
// rather than folded into the general PATCH edit — same reasoning as
// projects' archive/unarchive: a status transition shouldn't be
// reachable as a side effect of resubmitting an unrelated edit form.
// Only meaningful for type = "invoice"; already-paid hitting this is a
// no-op success, not an error, matching archive's idempotent-toggle
// convention.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id: projectId, documentId } = await params;

  const [document] = await db
    .select()
    .from(projectDocuments)
    .where(eq(projectDocuments.id, documentId))
    .limit(1);
  if (!document || document.projectId !== projectId) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  if (document.type !== "invoice") {
    return NextResponse.json(
      { error: "Only invoices can be marked paid." },
      { status: 400 },
    );
  }
  if (document.isPaid) {
    return NextResponse.json({ document });
  }

  const [updated] = await db
    .update(projectDocuments)
    .set({ isPaid: true, updatedAt: new Date() })
    .where(eq(projectDocuments.id, documentId))
    .returning();

  return NextResponse.json({ document: updated });
}
