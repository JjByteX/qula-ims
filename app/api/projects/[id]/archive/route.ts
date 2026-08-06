import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { authorizeUser } from "@/lib/auth/authorize";

// Archive action (phases-plan 3.1): active -> archived. Already-archived
// hitting this is a no-op success, not an error, matching the
// users/pending approve pattern — the end state the caller wanted is
// already true, so a double-click or stale tab shouldn't surface as a
// failure.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  if (project.status === "archived") {
    return NextResponse.json({ project });
  }

  const [updated] = await db
    .update(projects)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();

  return NextResponse.json({ project: updated });
}
