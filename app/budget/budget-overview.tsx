"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AllocatedFundsForm } from "./allocated-funds-form";
import { CURRENCY_SYMBOL, formatCurrency } from "@/lib/currency";
import { ExpensesSection, type Expense } from "./expenses-section";
import { BudgetSplitter } from "./budget-splitter";

// Owns the two numbers phases-plan 2.3's remaining-budget calculation
// needs — allocated funds and the expenses total — so it can recompute
// "remaining" the instant either child reports a change, without either
// child needing to know about the other. AllocatedFundsForm and
// ExpensesSection keep managing their own edit/list state; this only
// tracks the two derived values it needs to subtract.
export function BudgetOverview({
  initialAllocatedFunds,
  initialExpenses,
}: {
  initialAllocatedFunds: string;
  initialExpenses: Expense[];
}) {
  const [allocatedFunds, setAllocatedFunds] = useState(Number(initialAllocatedFunds));
  const [expensesTotal, setExpensesTotal] = useState(() =>
    initialExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0),
  );

  // Recalculates whenever either input changes (phases-plan 2.3), rather
  // than only on mount — useMemo here is just to avoid redoing the
  // subtraction on unrelated re-renders, not for correctness.
  const remaining = useMemo(
    () => allocatedFunds - expensesTotal,
    [allocatedFunds, expensesTotal],
  );
  const isOverBudget = remaining < 0;

  // BudgetSplitter fetches its own computed splits from the server
  // (they depend on team membership too, which this component has no
  // reason to know about) — this just needs to tell it "the inputs
  // changed, refetch" whenever remaining moves.
  const splitterRefreshKey = remaining;

  return (
    <>
      <Card className="rounded-[var(--radius-lg)]">
        <CardContent className="flex flex-col gap-1 p-8">
          <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
            Remaining budget
          </span>
          <p
            className={
              "text-[var(--text-xl)] font-semibold " +
              (isOverBudget ? "text-[var(--destructive)]" : "text-[var(--foreground)]")
            }
          >
            {isOverBudget ? "-" : ""}
            {CURRENCY_SYMBOL}
            {formatCurrency(String(Math.abs(remaining)))}
          </p>
          <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
            {CURRENCY_SYMBOL}
            {formatCurrency(String(allocatedFunds))} allocated · {CURRENCY_SYMBOL}
            {formatCurrency(String(expensesTotal))} spent
          </p>
        </CardContent>
      </Card>

      <AllocatedFundsForm
        initialAllocatedFunds={initialAllocatedFunds}
        onAllocatedFundsChange={(value) => setAllocatedFunds(Number(value))}
      />
      <ExpensesSection
        initialExpenses={initialExpenses}
        onTotalChange={setExpensesTotal}
      />
      <BudgetSplitter refreshKey={splitterRefreshKey} />
    </>
  );
}
