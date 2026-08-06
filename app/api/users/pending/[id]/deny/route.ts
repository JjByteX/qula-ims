import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { authorizeSuperadmin } from "@/lib/auth/authorize";

// Deny action (phases-plan 1.5): "removes or archives submission"
// (Client-Requests.md). Archiving via the existing "denied" status is
// chosen over a hard delete — it keeps the submission's info on record
// (who applied, when) without a separate deletion path, and the users
// table's status enum already has "denied" for exactly this.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeSuperadmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (user.status === "denied") {
    return NextResponse.json({ user });
  }
  if (user.status !== "pending") {
    return NextResponse.json(
      { error: "This request was already approved and can't be denied." },
      { status: 409 },
    );
  }

  const [updated] = await db
    .update(users)
    .set({ status: "denied", updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();

  return NextResponse.json({ user: updated });
}
