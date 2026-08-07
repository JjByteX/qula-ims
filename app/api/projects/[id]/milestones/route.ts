import { NextResponse } from "next/server";
import { asc, eq, max } from "drizzle-orm";
import { db } from "@/db/client";
import { milestones, projects } from "@/db/schema";
import { milestoneSchema } from "@/lib/validation/projects";
import { authorizeUser } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/activity/log";

// Milestones live under their project (phases-plan 3.1, revised for
// multi-milestone projects). Same open-edit rule as the project itself —
// any signed-in user, no per-owner restriction.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const list = await db
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, id))
    .orderBy(asc(milestones.sortOrder), asc(milestones.createdAt));

  return NextResponse.json({ milestones: list });
}

// New milestones append to the end of the list — sortOrder is the current
// max + 1, so a fresh milestone always lands last without needing the
// client to know the existing order.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id: projectId } = await params;

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = milestoneSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const [{ maxSortOrder }] = await db
    .select({ maxSortOrder: max(milestones.sortOrder) })
    .from(milestones)
    .where(eq(milestones.projectId, projectId));
  const nextSortOrder = String((Number(maxSortOrder) || 0) + 1);

  const [created] = await db
    .insert(milestones)
    .values({
      projectId,
      title: parsed.data.title,
      price: parsed.data.price,
      sortOrder: nextSortOrder,
      createdByUserId: auth.user.id,
    })
    .returning();

  await logActivity({
    actorUserId: auth.user.id,
    action: "milestone.created",
    targetType: "milestone",
    targetId: created.id,
    detail: { projectId, title: created.title },
  });

  return NextResponse.json({ milestone: created });
}
