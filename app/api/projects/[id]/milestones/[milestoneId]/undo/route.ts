import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { milestones, projectDocuments } from "@/db/schema";
import { authorizeUser } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/activity/log";

// Undo (Milestones 3-dot menu, "Mark as undone"): the counterpart to
// milestones/[milestoneId]/route.ts's DELETE guard, which blocks deleting
// a milestone that still has an invoice or AR — "remove the documents
// first" was previously a manual, two-step chore with no single place to
// do it. This does both steps together: delete any invoice/AR documents
// billed against this milestone, then reopen it (same status/completedAt
// reset as reopen/route.ts), so the milestone goes back to exactly the
// "completed, no documents yet" state the menu's "Mark as done to create
// invoice/AR" item expects to see next time.
//
// Deliberately its own POST (not folded into reopen/route.ts) since it
// does something reopen alone never does — deletes rows — and needs its
// own confirmation dialog on the client (DocumentToolbar's Refresh
// dialog is the existing precedent for confirming a destructive/
// overwriting action before calling its route).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id: projectId, milestoneId } = await params;

  const [milestone] = await db
    .select()
    .from(milestones)
    .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, projectId)))
    .limit(1);
  if (!milestone) {
    return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
  }

  const linkedDocuments = await db
    .select({ id: projectDocuments.id, type: projectDocuments.type })
    .from(projectDocuments)
    .where(eq(projectDocuments.milestoneId, milestoneId));

  for (const doc of linkedDocuments) {
    await db.delete(projectDocuments).where(eq(projectDocuments.id, doc.id));
    await logActivity({
      actorUserId: auth.user.id,
      action: "document.deleted",
      targetType: "document",
      targetId: doc.id,
      detail: { projectId, milestoneId, type: doc.type, reason: "milestone_undone" },
    });
  }

  const [updated] = await db
    .update(milestones)
    .set({ status: "pending", completedAt: null, updatedAt: new Date() })
    .where(eq(milestones.id, milestoneId))
    .returning();

  await logActivity({
    actorUserId: auth.user.id,
    action: "milestone.undone",
    targetType: "milestone",
    targetId: milestoneId,
    detail: { projectId, title: updated.title, documentsDeleted: linkedDocuments.length },
  });

  return NextResponse.json({ milestone: updated });
}
