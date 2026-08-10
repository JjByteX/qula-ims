import Link from "next/link";
import { CURRENCY_SYMBOL, formatCurrency } from "@/lib/currency";
import { Card, CardContent } from "@/components/ui/card";
import type { BudgetSplit } from "@/lib/budget/compute";

type Snapshot = {
  enabled: boolean;
  remaining: number;
  allocatedFunds: number;
  expensesTotal: number;
  splits: BudgetSplit[];
};

// Budget snapshot (phases-plan 5.1 / Client-Requests.md "Kept simple. One
// glance, no charts just for show."). One card, not three — the remaining
// number, the allocated/spent line, and the per-person splits are all the
// same logical concept (today's budget state), so per the card-fragmentation
// rule in docs/ux-ui-guidelines.md they stay together rather than each
// getting their own card. The whole card links to /budget (phases-plan 5.5
// "every dashboard section link to its full page").
export function BudgetSnapshot({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const { enabled, remaining, allocatedFunds, expensesTotal, splits } = initialSnapshot;
  const isOverBudget = remaining < 0;

  return (
    <Link href="/budget" className="block">
      <Card className="rounded-[var(--radius-lg)] transition-colors hover:bg-[var(--muted)]">
        <CardContent className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-1">
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
          </div>

          {enabled && splits.length > 0 && (
            <div className="flex flex-col divide-y divide-[var(--border-soft)] border-t border-[var(--border)]">
              {splits.map((split) => (
                <div
                  key={split.userId}
                  className="flex items-center justify-between gap-4 py-3 first:pt-3 last:pb-0"
                >
                  <span className="text-[var(--text-sm)] text-[var(--foreground)]">
                    {split.firstName} {split.lastName}
                  </span>
                  <span className="text-[var(--text-sm)] font-semibold text-[var(--foreground)]">
                    {CURRENCY_SYMBOL}
                    {formatCurrency(String(split.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
