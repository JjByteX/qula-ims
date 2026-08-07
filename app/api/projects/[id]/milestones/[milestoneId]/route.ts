import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { milestones, projectDocuments } from "@/db/schema";
import { milestoneSchema } from "@/lib/validation/projects";
import { authorizeUser } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/activity/log";

// Edit a milestone's title/price. Status (pending/completed) has its own
// endpoints (complete/reopen) — same "one focused endpoint per state
// transition" convention as project archive/unarchive.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id: projectId, milestoneId } = await params;

  const [existing] = await db
    .select()
    .from(milestones)
    .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, projectId)))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = milestoneSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const [updated] = await db
    .update(milestones)
    .set({ title: parsed.data.title, price: parsed.data.price, updatedAt: new Date() })
    .where(eq(milestones.id, milestoneId))
    .returning();

  await logActivity({
    actorUserId: auth.user.id,
    action: "milestone.edited",
    targetType: "milestone",
    targetId: milestoneId,
    detail: { projectId, title: updated.title },
  });

  return NextResponse.json({ milestone: updated });
}

// Deleting a milestone also removes any invoices/ARs billed against it
// (project_documents.milestoneId cascades — see db/schema/projects.ts),
// so this blocks the delete rather than silently taking billing documents
// down with it. The person has to remove those documents first, same
// spirit as not letting an archive silently hide unpaid invoices.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id: projectId, milestoneId } = await params;

  const [existing] = await db
    .select()
    .from(milestones)
    .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, projectId)))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
  }

  const [linkedDocument] = await db
    .select({ id: projectDocuments.id })
    .from(projectDocuments)
    .where(eq(projectDocuments.milestoneId, milestoneId))
    .limit(1);
  if (linkedDocument) {
    return NextResponse.json(
      { error: "This milestone has an invoice or AR. Remove it first, then delete the milestone." },
      { status: 409 },
    );
  }

  await db.delete(milestones).where(eq(milestones.id, milestoneId));

  await logActivity({
    actorUserId: auth.user.id,
    action: "milestone.deleted",
    targetType: "milestone",
    targetId: milestoneId,
    detail: { projectId, title: existing.title },
  });

  return NextResponse.json({ success: true });
}
