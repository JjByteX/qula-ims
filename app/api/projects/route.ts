import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { milestones, projects } from "@/db/schema";
import { projectSchema, milestoneSchema } from "@/lib/validation/projects";
import { authorizeUser } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/activity/log";
import { getProjectsWithComputedPrice } from "@/lib/projects/queries";

// Any signed-in user can view and create projects (phases-plan 3.1 /
// Client-Requests.md "Regular users can edit everything else in the
// system (projects, budget, invoices, etc.)"), same open-edit rule as
// budget — no per-owner restriction the way profiles have one.
//
// price here is computed (sum of the project's milestone prices) rather
// than stored, so the list view's price column can never drift from the
// milestones that actually make it up.
export async function GET(request: Request) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  // Archived projects are hidden by default so the list view only shows
  // what's actually ongoing — ?status=archived or ?status=all opts back
  // in, for a future "view archived" toggle rather than a separate page.
  const status = new URL(request.url).searchParams.get("status");
  const list = await getProjectsWithComputedPrice(
    status === "all" ? "all" : status === "archived" ? "archived" : "active",
  );

  return NextResponse.json({ projects: list });
}

// Creates a project together with its first milestone in one request —
// the common case is a project starting with at least one billable stage,
// so this avoids forcing "create project" then "add milestone" as two
// separate round trips for what's really one action.
const createProjectSchema = projectSchema.extend({ milestone: milestoneSchema });

export async function POST(request: Request) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const [createdProject] = await db
    .insert(projects)
    .values({ title: parsed.data.title, createdByUserId: auth.user.id })
    .returning();

  const [createdMilestone] = await db
    .insert(milestones)
    .values({
      projectId: createdProject.id,
      title: parsed.data.milestone.title,
      price: parsed.data.milestone.price,
      sortOrder: "0",
      createdByUserId: auth.user.id,
    })
    .returning();

  await logActivity({
    actorUserId: auth.user.id,
    action: "project.created",
    targetType: "project",
    targetId: createdProject.id,
    detail: { title: createdProject.title },
  });
  await logActivity({
    actorUserId: auth.user.id,
    action: "milestone.created",
    targetType: "milestone",
    targetId: createdMilestone.id,
    detail: { projectId: createdProject.id, title: createdMilestone.title },
  });

  return NextResponse.json({
    project: { ...createdProject, price: createdMilestone.price },
    milestone: createdMilestone,
  });
}
