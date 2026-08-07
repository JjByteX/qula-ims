import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { projectSchema } from "@/lib/validation/projects";
import { authorizeUser } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/activity/log";
import { getProjectDetail } from "@/lib/projects/queries";

// Backs the milestones dialog (MilestonesDialogProvider), which opens as
// a plain client-side modal — no route/URL of its own — from the
// dashboard, projects list, or notification menu. The dialog fetches
// project + milestones + documents here on open rather than relying on
// any page's server-rendered data, since it can be triggered from
// several different pages and isn't tied to a route.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const detail = await getProjectDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json(detail);
}

// Edit (phases-plan 3.1). Any signed-in user, same as create — see
// app/api/projects/route.ts for why this isn't self-or-superadmin gated
// the way profile edits are. Only title is editable here now — milestones
// have their own routes (app/api/projects/[id]/milestones/...) since each
// one has its own title/price/status. Archiving is a separate action
// endpoint (app/api/projects/[id]/archive/route.ts) rather than a status
// field here, matching the users/pending approve/deny pattern of one
// focused endpoint per status transition.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const [existing] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = projectSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const [updated] = await db
    .update(projects)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();

  await logActivity({
    actorUserId: auth.user.id,
    action: "project.edited",
    targetType: "project",
    targetId: id,
    detail: { fields: Object.keys(parsed.data) },
  });

  return NextResponse.json({ project: updated });
}
