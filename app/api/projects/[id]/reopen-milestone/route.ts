import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { authorizeUser } from "@/lib/auth/authorize";

// Reverse of complete-milestone — e.g. correcting an accidental click,
// or the milestone turned out not to be fully done. Same idempotent,
// single-intent shape as unarchive/mark-unpaid.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  if (!project.milestoneCompleted) {
    return NextResponse.json({ project });
  }

  const [updated] = await db
    .update(projects)
    .set({ milestoneCompleted: false, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();

  return NextResponse.json({ project: updated });
}
