import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projectDocuments } from "@/db/schema";
import { authorizeUser } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/activity/log";

// Reverse of mark-paid — kept as its own endpoint for the same reason
// archive has a separate unarchive rather than one endpoint taking a
// body flag: each action is independently idempotent and easy to reason
// about from the client (one button, one intent, no payload).
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
      { error: "Only invoices can be marked unpaid." },
      { status: 400 },
    );
  }
  if (!document.isPaid) {
    return NextResponse.json({ document });
  }

  const [updated] = await db
    .update(projectDocuments)
    .set({ isPaid: false, updatedAt: new Date() })
    .where(eq(projectDocuments.id, documentId))
    .returning();

  await logActivity({
    actorUserId: auth.user.id,
    action: "invoice.marked_unpaid",
    targetType: "document",
    targetId: documentId,
    detail: { projectId, title: updated.title },
  });

  return NextResponse.json({ document: updated });
}
