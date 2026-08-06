import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { authorizeUser } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/activity/log";

// Milestone completion toggle (phases-plan 3.4). Separate from
// archive/unarchive — status is visibility, this is progress. Marking a
// milestone complete is what makes "finished milestones with no invoice
// or AR made yet" (Client-Requests.md dashboard spec) a checkable fact
// rather than a guess. Already-complete hitting this is a no-op success,
// matching archive's idempotent-toggle convention.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  if (project.milestoneCompleted) {
    return NextResponse.json({ project });
  }

  const [updated] = await db
    .update(projects)
    .set({ milestoneCompleted: true, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();

  await logActivity({
    actorUserId: auth.user.id,
    action: "project.milestone_completed",
    targetType: "project",
    targetId: id,
    detail: { milestone: updated.milestone },
  });

  return NextResponse.json({ project: updated });
}
