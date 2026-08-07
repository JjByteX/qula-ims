import { eq, inArray, and } from "drizzle-orm";
import { db } from "@/db/client";
import { budget, budgetSplits, expenses, users, milestones, projectDocuments } from "@/db/schema";

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

// Sum of paid milestones — a milestone counts once it has at least one
// projectDocuments row of type "invoice" with isPaid = true. The invoice's
// own amount is used directly (rather than re-joining back to the
// milestone's price) since the two are guaranteed identical in this app
// and the invoice amount is the more semantically correct field: it's
// literally what was invoiced and paid.
async function getPaidMilestonesTotal() {
  const paidInvoices = await db
    .select({ amount: projectDocuments.amount })
    .from(projectDocuments)
    .innerJoin(milestones, eq(projectDocuments.milestoneId, milestones.id))
    .where(and(eq(projectDocuments.type, "invoice"), eq(projectDocuments.isPaid, true)));

  return paidInvoices.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
}

export type BudgetSplit = {
  userId: string;
  firstName: string;
  lastName: string;
  percentage: number;
  isManual: boolean;
  amount: number;
};

// Computes each active user's dollar share of the team split pool, plus
// the allocated-funds reserve's own remaining balance.
//
// Two pots, chained rather than independent:
//   1. Paid milestones (invoice.isPaid = true) are the money that's come
//      in.
//   2. Allocated Funds is a reserve carved out of that income for a
//      specific purpose; Expenses draw down that reserve. Its own
//      remaining balance is `allocatedFunds - expensesTotal` — unchanged
//      mechanically from before.
//   3. What's left to split among the team is the milestone income minus
//      the reserve taken out of it: `totalPaidMilestones - allocatedFunds`
//      — not the reserve's remaining balance, the reserve amount itself,
//      since that's what was set aside from the team's pool regardless of
//      how much of it has been spent yet.
//
// Recalculated on every read instead of being cached.
export async function computeSplits(): Promise<{
  remaining: number;
  allocatedFunds: number;
  expensesTotal: number;
  splitPool: number;
  splits: BudgetSplit[];
}> {
  const current = await getOrCreateBudget();
  const activeUsers = await getActiveUsers();

  const expenseRows = await db.select({ amount: expenses.amount }).from(expenses);
  const expensesTotal = expenseRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const allocatedFunds = Number(current.allocatedFunds);
  const remaining = allocatedFunds - expensesTotal;

  const totalPaidMilestones = await getPaidMilestonesTotal();
  const splitPool = totalPaidMilestones - allocatedFunds;

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
      amount: (splitPool * percentage) / 100,
    };
  });

  return { remaining, allocatedFunds, expensesTotal, splitPool, splits };
}
