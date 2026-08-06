import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { budget } from "@/db/schema";
import { allocatedFundsSchema } from "@/lib/validation/budget";
import { authorizeUser } from "@/lib/auth/authorize";

// The budget table is a single ongoing record (see db/schema/budget.ts's
// comment), not seeded by a migration. This reads the one row if it
// exists, or creates a zero-funded default row on first access, so the
// page never has to special-case "no budget yet" beyond an empty display.
async function getOrCreateBudget() {
  const [existing] = await db.select().from(budget).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(budget).values({}).returning();
  return created;
}

// View is open to any signed-in user, same as the edit right below —
// Client-Requests.md draws no view/edit distinction for budget the way it
// does for profiles.
export async function GET() {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const current = await getOrCreateBudget();
  return NextResponse.json({ budget: current });
}

// Set or update allocated funds (phases-plan 2.1). Any signed-in user, not
// superadmin-only — Client-Requests.md: "Regular users can edit everything
// else in the system (projects, budget, invoices, etc.)".
export async function PATCH(request: Request) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = allocatedFundsSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const current = await getOrCreateBudget();
  const [updated] = await db
    .update(budget)
    .set({
      allocatedFunds: parsed.data.allocatedFunds,
      updatedByUserId: auth.user.id,
      updatedAt: new Date(),
    })
    .where(eq(budget.id, current.id))
    .returning();

  return NextResponse.json({ budget: updated });
}
