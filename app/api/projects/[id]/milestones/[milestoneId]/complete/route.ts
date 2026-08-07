import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { milestones } from "@/db/schema";
import { authorizeUser } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/activity/log";

// Milestone completion toggle (phases-plan 3.4, now per-milestone). Marking
// a milestone complete is what makes "finished milestones with no invoice
// or AR made yet" (Client-Requests.md dashboard spec) a checkable fact
// rather than a guess. Already-complete hitting this is a no-op success,
// matching archive's idempotent-toggle convention.
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
  if (milestone.status === "completed") {
    return NextResponse.json({ milestone });
  }

  const [updated] = await db
    .update(milestones)
    .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(milestones.id, milestoneId))
    .returning();

  await logActivity({
    actorUserId: auth.user.id,
    action: "milestone.completed",
    targetType: "milestone",
    targetId: milestoneId,
    detail: { projectId, title: updated.title },
  });

  return NextResponse.json({ milestone: updated });
}
