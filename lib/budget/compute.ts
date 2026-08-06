import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { budget, budgetSplits, expenses, users } from "@/db/schema";

// Shared with app/api/budget/splitter/route.ts and the dashboard's budget
// snapshot (phases-plan 5.1) — moved here so both read the exact same
// calculation instead of the dashboard duplicating it or making a
// server-to-server HTTP call to its own API route.

export async function getOrCreateBudget() {
  const [existing] = await db.select().from(budget).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(budget).values({}).returning();
  return created;
}

// Team members for the splitter (phases-plan 2.4) are active users —
// pending and denied accounts aren't part of the team yet, same status
// check used to gate other "active user" behavior elsewhere in the app.
export async function getActiveUsers() {
  return db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.status, "active"));
}

export type BudgetSplit = {
  userId: string;
  firstName: string;
  lastName: string;
  percentage: number;
  isManual: boolean;
  amount: number;
};

// Computes each active user's dollar share of the remaining budget.
// Always on (phases-plan 2.4 / Client-Requests.md: "Splits the budget
// across team members"). Users with a stored override use that
// percentage; everyone else splits whatever percentage is left over
// equally. Recalculated on every read instead of being cached.
export async function computeSplits(): Promise<{
  remaining: number;
  allocatedFunds: number;
  expensesTotal: number;
  splits: BudgetSplit[];
}> {
  const current = await getOrCreateBudget();
  const activeUsers = await getActiveUsers();

  const expenseRows = await db.select({ amount: expenses.amount }).from(expenses);
  const expensesTotal = expenseRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const allocatedFunds = Number(current.allocatedFunds);
  const remaining = allocatedFunds - expensesTotal;

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

  return { remaining, allocatedFunds, expensesTotal, splits };
}
