import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { projectSchema } from "@/lib/validation/projects";
import { authorizeUser } from "@/lib/auth/authorize";

// Any signed-in user can view and create projects (phases-plan 3.1 /
// Client-Requests.md "Regular users can edit everything else in the
// system (projects, budget, invoices, etc.)"), same open-edit rule as
// budget — no per-owner restriction the way profiles have one.
export async function GET(request: Request) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  // Archived projects are hidden by default so the list view only shows
  // what's actually ongoing — ?status=archived or ?status=all opts back
  // in, for a future "view archived" toggle rather than a separate page.
  const status = new URL(request.url).searchParams.get("status");
  const list =
    status === "all"
      ? await db.select().from(projects).orderBy(desc(projects.createdAt))
      : await db
          .select()
          .from(projects)
          .where(eq(projects.status, status === "archived" ? "archived" : "active"))
          .orderBy(desc(projects.createdAt));

  return NextResponse.json({ projects: list });
}

export async function POST(request: Request) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = projectSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const [created] = await db
    .insert(projects)
    .values({ ...parsed.data, createdByUserId: auth.user.id })
    .returning();

  return NextResponse.json({ project: created });
}
