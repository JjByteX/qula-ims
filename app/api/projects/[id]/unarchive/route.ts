import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { authorizeUser } from "@/lib/auth/authorize";

// Restore action: archived -> active. Archiving is described as
// reversible in phases-plan 3.1 ("archive", not "delete"), so there
// needs to be a way back — same idempotent shape as archive/route.ts.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  if (project.status === "active") {
    return NextResponse.json({ project });
  }

  const [updated] = await db
    .update(projects)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();

  return NextResponse.json({ project: updated });
}
