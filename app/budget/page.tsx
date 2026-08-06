import { desc } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/db/client";
import { budget, expenses } from "@/db/schema";
import { BudgetOverview } from "./budget-overview";

// Any signed-in user can view and edit allocated funds (phases-plan 2.1 /
// Client-Requests.md — budget isn't superadmin-gated). Reads or lazily
// creates the single ongoing budget row directly here, same
// getOrCreate reasoning as app/api/budget/route.ts, so the first paint
// already has real data instead of a loading flash.
export default async function BudgetPage() {
  await requireUser();

  const [existing] = await db.select().from(budget).limit(1);
  const current = existing ?? (await db.insert(budget).values({}).returning())[0];
  const expenseList = await db.select().from(expenses).orderBy(desc(expenses.date));

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-[var(--text-xl)] font-semibold text-[var(--foreground)]">
            Budget
          </h1>
          <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
            Set the total budget the company has to work with.
          </p>
        </div>

        <BudgetOverview
          initialAllocatedFunds={current.allocatedFunds}
          initialExpenses={expenseList}
        />
      </div>
    </main>
  );
}
