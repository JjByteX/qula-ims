import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { milestones } from "@/db/schema";
import { milestoneReorderSchema } from "@/lib/validation/projects";
import { authorizeUser } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/activity/log";

// Reorder (drag-and-drop) all of a project's milestones in one request —
// the client sends the full new ordering as an id list, and sortOrder is
// rewritten to match that list's index. Rejects ids that don't belong to
// this project rather than silently ignoring them, so a stale client
// can't reorder into a different project's milestones.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id: projectId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = milestoneReorderSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const existing = await db
    .select({ id: milestones.id })
    .from(milestones)
    .where(
      and(eq(milestones.projectId, projectId), inArray(milestones.id, parsed.data.milestoneIds)),
    );
  const existingIds = new Set(existing.map((row) => row.id));
  const allBelongToProject =
    existingIds.size === parsed.data.milestoneIds.length &&
    parsed.data.milestoneIds.every((id) => existingIds.has(id));
  if (!allBelongToProject) {
    return NextResponse.json(
      { error: "One or more milestones don't belong to this project." },
      { status: 400 },
    );
  }

  await Promise.all(
    parsed.data.milestoneIds.map((milestoneId, index) =>
      db
        .update(milestones)
        .set({ sortOrder: String(index), updatedAt: new Date() })
        .where(eq(milestones.id, milestoneId)),
    ),
  );

  await logActivity({
    actorUserId: auth.user.id,
    action: "milestone.reordered",
    targetType: "project",
    targetId: projectId,
    detail: { milestoneIds: parsed.data.milestoneIds },
  });

  const updated = await db
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, projectId))
    .orderBy(milestones.sortOrder);

  return NextResponse.json({ milestones: updated });
}
