import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { budget, budgetSplits, expenses, users } from "@/db/schema";
import { budgetSplitterSchema } from "@/lib/validation/budget";
import { authorizeUser } from "@/lib/auth/authorize";

// Team members for the splitter (phases-plan 2.4) are active users —
// pending and denied accounts aren't part of the team yet, same status
// check used to gate other "active user" behavior (e.g. login,
// forgot-password) elsewhere in the app.
async function getActiveUsers() {
  return db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.status, "active"));
}

async function getOrCreateBudget() {
  const [existing] = await db.select().from(budget).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(budget).values({}).returning();
  return created;
}

// Computes each active user's dollar share of the remaining budget.
// Users with a stored override use that percentage; everyone else splits
// whatever percentage is left over equally. Recalculated on every read
// (phases-plan 2.4 "recalculate... when budget or team changes") instead
// of being cached, so a new hire or a fresh expense is reflected
// immediately without a separate recompute step.
async function computeSplits() {
  const current = await getOrCreateBudget();
  const activeUsers = await getActiveUsers();

  const expenseRows = await db.select({ amount: expenses.amount }).from(expenses);
  const expensesTotal = expenseRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const remaining = Number(current.allocatedFunds) - expensesTotal;

  const overrides = activeUsers.length
    ? await db
        .select()
        .from(budgetSplits)
        .where(
          inArray(
            budgetSplits.userId,
            activeUsers.map((u) => u.id),
          ),
        )
    : [];
  const overrideByUserId = new Map(overrides.map((o) => [o.userId, o]));

  const overriddenPercentageTotal = overrides.reduce(
    (sum, o) => sum + (o.percentage ? Number(o.percentage) : 0),
    0,
  );
  const usersWithoutOverride = activeUsers.filter((u) => !overrideByUserId.get(u.id)?.percentage);
  const equalSharePercentage = usersWithoutOverride.length
    ? (100 - overriddenPercentageTotal) / usersWithoutOverride.length
    : 0;

  const splits = activeUsers.map((user) => {
    const override = overrideByUserId.get(user.id);
    const percentage = override?.percentage ? Number(override.percentage) : equalSharePercentage;
    return {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      percentage,
      isManual: !!override?.percentage,
      amount: (remaining * percentage) / 100,
    };
  });

  return { enabled: current.splitterEnabled, remaining, splits };
}

// View is open to any signed-in user, same as the rest of the budget
// module (phases-plan 2.1's "not superadmin-gated" reasoning applies
// here too).
export async function GET() {
  const auth = await authorizeUser();
  if (!auth.ok) return auth.response;

  const result = await computeSplits();
  return NextResponse.json(result);
}

// Toggles the splitter on/off and replaces manual overrides
// (phases-plan 2.4). Any signed-in user, not superadmin-only, matching
// every other budget edit in this module.
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
    await tx
      .update(budget)
      .set({ splitterEnabled: parsed.data.enabled, updatedByUserId: auth.user.id, updatedAt: new Date() })
      .where(eq(budget.id, current.id));

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

  const result = await computeSplits();
  return NextResponse.json(result);
}
