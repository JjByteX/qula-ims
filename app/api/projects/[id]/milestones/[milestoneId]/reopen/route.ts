import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { milestones } from "@/db/schema";
import { authorizeUser } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/activity/log";

// Reverse of complete — e.g. correcting an accidental click, or the
// milestone turned out not to be fully done. Same idempotent,
// single-intent shape as unarchive/mark-unpaid.
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
  if (milestone.status === "pending") {
    return NextResponse.json({ milestone });
  }

  const [updated] = await db
    .update(milestones)
    .set({ status: "pending", completedAt: null, updatedAt: new Date() })
    .where(eq(milestones.id, milestoneId))
    .returning();

  await logActivity({
    actorUserId: auth.user.id,
    action: "milestone.reopened",
    targetType: "milestone",
    targetId: milestoneId,
    detail: { projectId, title: updated.title },
  });

  return NextResponse.json({ milestone: updated });
}
