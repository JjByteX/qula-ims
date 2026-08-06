import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { budgetSplits } from "@/db/schema";
import { budgetSplitterSchema } from "@/lib/validation/budget";
import { authorizeUser } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/activity/log";
import { getOrCreateBudget, getActiveUsers, computeSplits } from "@/lib/budget/compute";

// View is open to any signed-in user, same as the rest of the budget
// module (phases-plan 2.1's "not superadmin-gated" reasoning applies
// here too).
export async function GET() {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const result = await computeSplits();
  return NextResponse.json(result);
}

// Replaces manual split overrides (phases-plan 2.4). Always on — any
// signed-in user, not superadmin-only, matching every other budget edit
// in this module.
export async function PATCH(request: Request) {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = budgetSplitterSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const activeUsers = await getActiveUsers();
  const activeUserIds = new Set(activeUsers.map((u) => u.id));
  const unknownUserId = parsed.data.overrides.find((o) => !activeUserIds.has(o.userId));
  if (unknownUserId) {
    return NextResponse.json(
      { error: "One of the selected people is not an active team member." },
      { status: 400 },
    );
  }

  const current = await getOrCreateBudget();

  await db.transaction(async (tx) => {
    // Overrides are fully replaced rather than diffed — the whole set
    // comes from one form submission, so upserting per-user and then
    // clearing anyone no longer in the payload is simpler and just as
    // correct as computing an add/update/remove diff.
    if (activeUsers.length) {
      await tx.delete(budgetSplits).where(
        inArray(
          budgetSplits.userId,
          activeUsers.map((u) => u.id),
        ),
      );
    }
    if (parsed.data.overrides.length) {
      await tx.insert(budgetSplits).values(
        parsed.data.overrides.map((o) => ({
          userId: o.userId,
          percentage: o.percentage,
          updatedAt: new Date(),
        })),
      );
    }
  });

  await logActivity({
    actorUserId: auth.user.id,
    action: "budget.splitter_updated",
    targetType: "budget",
    targetId: current.id,
    detail: { overrideCount: parsed.data.overrides.length },
  });

  const result = await computeSplits();
  return NextResponse.json(result);
}
