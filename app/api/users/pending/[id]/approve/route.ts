import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { authorizeSuperadmin } from "@/lib/auth/authorize";

// Approve action (phases-plan 1.5): pending -> active. Only a row that's
// still "pending" can be approved — already-active or already-denied users
// hitting this endpoint (double-click, stale tab) is a no-op, not an error,
// since the end state the caller wanted is already true.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeSuperadmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (user.status === "active") {
    return NextResponse.json({ user });
  }
  if (user.status !== "pending") {
    return NextResponse.json(
      { error: "This request was already denied and can't be approved." },
      { status: 409 },
    );
  }

  const [updated] = await db
    .update(users)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();

  return NextResponse.json({ user: updated });
}
