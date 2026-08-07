"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CURRENCY_SYMBOL, formatCurrency } from "@/lib/currency";
import {
  allocatedFundsSchema,
  budgetSplitterSchema,
  expenseSchema,
  type AllocatedFundsInput,
  type ExpenseInput,
} from "@/lib/validation/budget";
import type { BudgetSplit } from "@/lib/budget/compute";

export type Expense = {
  id: string;
  amount: string;
  description: string;
  date: string;
};

type SplitterState = {
  remaining: number;
  splitPool: number;
  splits: BudgetSplit[];
};

function formatDate(value: string): string {
  // value is YYYY-MM-DD (see db/schema/budget.ts's date column) — parsed
  // as UTC via the T00:00:00 suffix so the displayed day never shifts a
  // day off due to the browser's local timezone.
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// "J. Doe" — used only in the compact split legend, where several names
// sit on one line and need to stay short. Full names are still used
// everywhere else (editing form, profile pages) since that's the
// legally/administratively correct form.
function shortName(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}. ${lastName}`;
}

// Split-bar colors — deliberately outside the mandatory five (gold/cream/
// off-white/warm-white/charcoal) at the person's request, since gold vs.
// muted-charcoal-tints read as "one accent + shades of grey" once there
// are 2-3 people to tell apart at a glance. Cycles if there are ever more
// than three team members.
const SPLIT_COLORS = ["#5B7B7A", "#B0654A", "#6E5C8A"];

function splitColor(index: number): string {
  return SPLIT_COLORS[index % SPLIT_COLORS.length];
}

// Budget (phases-plan 2 / Client-Requests.md) folded into the dashboard
// as one card instead of a separate /budget page — allocated funds,
// expenses, remaining budget, and the split are all one logical concept
// (today's budget state), so per the card-fragmentation rule in
// docs/ux-ui-guidelines.md they stay together. The splitter itself is
// always on (Client-Requests.md "Splits the budget across team members"
// has no mention of turning it off), so there's no enable/disable
// control — but per-person percentages are still editable ("Equal split
// by default, but you can change it"), same override behavior as before.
// Order follows the math rather than a fixed hierarchy: split, then the
// two inputs (allocated, expenses), then remaining budget last as the
// number those two inputs produce, not a headline sitting above its own
// causes.
export function BudgetSection({
  initialAllocatedFunds,
  initialExpenses,
  initialSplitterState,
  pendingMilestoneCount,
  pendingMilestonesTotal,
}: {
  initialAllocatedFunds: string;
  initialExpenses: Expense[];
  initialSplitterState: SplitterState;
  pendingMilestoneCount: number;
  pendingMilestonesTotal: string;
}) {
  const [allocatedFunds, setAllocatedFunds] = useState(initialAllocatedFunds);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [splitterState, setSplitterState] = useState(initialSplitterState);

  const [isEditingFunds, setIsEditingFunds] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [expenseListError, setExpenseListError] = useState<string | null>(null);
  const [isEditingSplit, setIsEditingSplit] = useState(false);
  const [draftPercentages, setDraftPercentages] = useState<Record<string, string>>({});
  const [splitError, setSplitError] = useState<string | null>(null);
  const [isSavingSplit, setIsSavingSplit] = useState(false);

  const expensesTotal = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.amount), 0),
    [expenses],
  );
  const remaining = useMemo(
    () => Number(allocatedFunds) - expensesTotal,
    [allocatedFunds, expensesTotal],
  );
  const isOverBudget = remaining < 0;

  // Splits depend on the remaining budget and team membership, so they're
  // refetched from the server (which already knows the team) whenever
  // remaining moves, instead of duplicating the split math here.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/budget/splitter")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SplitterState | null) => {
        if (data && !cancelled) setSplitterState(data);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const fundsForm = useForm<AllocatedFundsInput>({
    resolver: zodResolver(allocatedFundsSchema),
    mode: "onChange",
    defaultValues: { allocatedFunds: initialAllocatedFunds },
  });

  function startEditingFunds() {
    fundsForm.reset({ allocatedFunds });
    setIsEditingFunds(true);
  }

  async function submitFunds(data: AllocatedFundsInput) {
    const res = await fetch("/api/budget", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      fundsForm.setError("allocatedFunds", {
        message: body?.error ?? "Something went wrong. Try again.",
      });
      return;
    }
    const { budget: updated } = await res.json();
    setAllocatedFunds(updated.allocatedFunds);
    setIsEditingFunds(false);
  }

  async function handleCreateExpense(data: ExpenseInput) {
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Something went wrong.");
    }
    const { expense } = await res.json();
    setExpenses((prev) =>
      [...prev, expense].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    );
    setIsAddingExpense(false);
  }

  async function handleUpdateExpense(id: string, data: ExpenseInput) {
    const res = await fetch(`/api/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Something went wrong.");
    }
    const { expense } = await res.json();
    setExpenses((prev) =>
      prev
        .map((e) => (e.id === id ? expense : e))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    );
    setEditingExpenseId(null);
  }

  async function handleDeleteExpense(id: string) {
    setDeletingExpenseId(id);
    setExpenseListError(null);
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setExpenseListError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setExpenseListError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setDeletingExpenseId(null);
    }
  }

  function startEditingSplit() {
    setDraftPercentages(
      Object.fromEntries(
        splitterState.splits.filter((s) => s.isManual).map((s) => [s.userId, String(s.percentage)]),
      ),
    );
    setSplitError(null);
    setIsEditingSplit(true);
  }

  function setDraftPercentage(userId: string, value: string) {
    setDraftPercentages((prev) => ({ ...prev, [userId]: value }));
  }

  function clearSplitOverride(userId: string) {
    setDraftPercentages((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }

  async function saveSplit() {
    setSplitError(null);
    const overrides = Object.entries(draftPercentages)
      .filter(([, value]) => value.trim() !== "")
      .map(([userId, percentage]) => ({ userId, percentage }));

    const parsed = budgetSplitterSchema.safeParse({ overrides });
    if (!parsed.success) {
      setSplitError(parsed.error.issues[0]?.message ?? "Enter valid percentages.");
      return;
    }

    setIsSavingSplit(true);
    try {
      const res = await fetch("/api/budget/splitter", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setSplitError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      const data: SplitterState = await res.json();
      setSplitterState(data);
      setIsEditingSplit(false);
    } catch {
      setSplitError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsSavingSplit(false);
    }
  }

  return (
    <Card className="flex h-full min-h-0 flex-col rounded-[var(--radius-sm)]">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
        {/* Outstanding — same label/number pattern as Remaining budget
            below (small muted caption, big bold amount). Sits above Split
            since what's still owed is the first thing that matters at a
            glance, followed by the border-t divider used everywhere else
            in this card to separate sections. */}
        {pendingMilestoneCount > 0 && (
          <div className="flex flex-col gap-1 border-b border-[var(--border)] pb-6">
            <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
              Outstanding
            </span>
            <p className="text-[var(--text-xl)] font-semibold text-[var(--foreground)]">
              {CURRENCY_SYMBOL}
              {formatCurrency(pendingMilestonesTotal)}
            </p>
            <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
              {pendingMilestoneCount}{" "}
              {pendingMilestoneCount === 1 ? "milestone" : "milestones"} remaining
            </p>
          </div>
        )}

        {/* Budget split — always on */}
        {splitterState.splits.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
                Split
              </span>
              {!isEditingSplit && (
                <Button variant="outline" size="sm" onClick={startEditingSplit}>
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit split
                </Button>
              )}
            </div>

            {splitError && (
              <p className="text-[var(--text-sm)] text-[var(--destructive)]">{splitError}</p>
            )}

            {isEditingSplit ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col divide-y divide-[var(--border)]">
                  {splitterState.splits.map((split) => (
                    <div
                      key={split.userId}
                      className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <span className="text-[var(--text-base)] text-[var(--foreground)]">
                        {split.firstName} {split.lastName}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="relative w-24">
                          <Input
                            inputMode="decimal"
                            placeholder={split.percentage.toFixed(0)}
                            value={draftPercentages[split.userId] ?? ""}
                            onChange={(e) => setDraftPercentage(split.userId, e.target.value)}
                            className="pr-7"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-sm)] text-[var(--muted-foreground)]">
                            %
                          </span>
                        </div>
                        {draftPercentages[split.userId] !== undefined && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Use equal split for this person"
                            onClick={() => clearSplitOverride(split.userId)}
                          >
                            <X className="size-4" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
                  Leave a field blank to give that person an equal share of what's left.
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={saveSplit} disabled={isSavingSplit}>
                    <Save className="size-4" aria-hidden="true" />
                    {isSavingSplit ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingSplit(false)}
                    disabled={isSavingSplit}
                  >
                    <X className="size-4" aria-hidden="true" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Segmented bar: one flush horizontal line, each person's
                    share sized by percentage. Compact replacement for the
                    old one-row-per-person list — same information (name,
                    percentage, amount), far less vertical space. Colors
                    come from SPLIT_COLORS, not the mandatory gold/charcoal
                    pair, so 2-3 people stay visually distinct at a glance. */}
                <div className="flex h-2 w-full overflow-hidden rounded-[var(--radius-sm)] bg-[var(--muted)]">
                  {splitterState.splits.map((split, index) => (
                    <div
                      key={split.userId}
                      className="h-full first:rounded-l-[var(--radius-sm)] last:rounded-r-[var(--radius-sm)]"
                      style={{
                        width: `${Math.max(split.percentage, 0)}%`,
                        backgroundColor: splitColor(index),
                      }}
                    />
                  ))}
                </div>

                {/* Legend columns share the bar's proportions (same
                    percentage-based width per person), so each person's
                    name/amount sits centered directly under their own
                    segment instead of flowing as one inline row. */}
                <div className="flex w-full">
                  {splitterState.splits.map((split, index) => (
                    <div
                      key={split.userId}
                      className="flex flex-col items-center gap-1 px-1 text-center"
                      style={{ width: `${Math.max(split.percentage, 0)}%` }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: splitColor(index) }}
                          aria-hidden="true"
                        />
                        <span className="truncate text-[var(--text-base)] text-[var(--foreground)]">
                          {shortName(split.firstName, split.lastName)} ({split.percentage.toFixed(0)}%
                          {split.isManual ? " · custom" : ""})
                        </span>
                      </div>
                      <span className="text-[var(--text-base)] font-semibold text-[var(--foreground)]">
                        {CURRENCY_SYMBOL}
                        {formatCurrency(String(split.amount))}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-4">
                  <div className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
                    Paid to date: {CURRENCY_SYMBOL}
                    {formatCurrency(String(splitterState.splitPool))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Allocated funds */}
        <div
          className={
            "flex flex-col gap-3" +
            (splitterState.splits.length > 0 ? " border-t border-[var(--border)] pt-6" : "")
          }
        >
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
              Allocated funds
            </span>
            {!isEditingFunds && (
              <Button variant="outline" size="sm" onClick={startEditingFunds}>
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Button>
            )}
          </div>

          {isEditingFunds ? (
            <form
              onSubmit={fundsForm.handleSubmit(submitFunds)}
              className="flex flex-col gap-4"
              noValidate
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-base)] text-[var(--muted-foreground)]">
                  {CURRENCY_SYMBOL}
                </span>
                <Input
                  inputMode="decimal"
                  className="pl-7"
                  aria-invalid={!!fundsForm.formState.errors.allocatedFunds}
                  {...fundsForm.register("allocatedFunds")}
                />
              </div>
              {fundsForm.formState.errors.allocatedFunds && (
                <p className="text-[var(--text-sm)] text-[var(--destructive)]">
                  {fundsForm.formState.errors.allocatedFunds.message}
                </p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!fundsForm.formState.isValid || fundsForm.formState.isSubmitting}
                >
                  <Save className="size-4" aria-hidden="true" />
                  {fundsForm.formState.isSubmitting ? "Saving..." : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingFunds(false)}
                  disabled={fundsForm.formState.isSubmitting}
                >
                  <X className="size-4" aria-hidden="true" />
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-[var(--text-xl)] font-semibold text-[var(--foreground)]">
              {CURRENCY_SYMBOL}
              {formatCurrency(allocatedFunds)}
            </p>
          )}
        </div>

        {/* Actual expenses */}
        <div className="flex flex-col gap-4 border-t border-[var(--border)] pt-6">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
              Actual expenses
            </span>
            {!isAddingExpense && (
              <Button variant="outline" size="sm" onClick={() => setIsAddingExpense(true)}>
                <Plus className="size-4" aria-hidden="true" />
                Add expense
              </Button>
            )}
          </div>

          {isAddingExpense && (
            <ExpenseForm
              defaultValues={{ amount: "", description: "", date: "" }}
              onSubmit={handleCreateExpense}
              onCancel={() => setIsAddingExpense(false)}
              submitLabel="Add"
            />
          )}

          {expenseListError && (
            <p className="text-[var(--text-sm)] text-[var(--destructive)]">{expenseListError}</p>
          )}

          {expenses.length === 0 && !isAddingExpense ? (
            <p className="py-4 text-center text-[var(--text-sm)] text-[var(--muted-foreground)]">
              No expenses recorded yet.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {expenses.map((expense) =>
                editingExpenseId === expense.id ? (
                  <div key={expense.id} className="py-4 first:pt-0 last:pb-0">
                    <ExpenseForm
                      defaultValues={{
                        amount: expense.amount,
                        description: expense.description,
                        date: expense.date,
                      }}
                      onSubmit={(data) => handleUpdateExpense(expense.id, data)}
                      onCancel={() => setEditingExpenseId(null)}
                      submitLabel="Save"
                    />
                  </div>
                ) : (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[var(--text-base)] text-[var(--foreground)]">
                        {expense.description}
                      </span>
                      <span className="text-[var(--text-sm)] text-[var(--muted-foreground)]">
                        {formatDate(expense.date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--text-base)] font-semibold text-[var(--foreground)]">
                        {CURRENCY_SYMBOL}
                        {formatCurrency(expense.amount)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit expense"
                        onClick={() => setEditingExpenseId(expense.id)}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete expense"
                        disabled={deletingExpenseId === expense.id}
                        onClick={() => handleDeleteExpense(expense.id)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        {/* Remaining budget */}
        <div className="flex flex-col gap-1 border-t border-[var(--border)] pt-6">
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
        </div>
      </CardContent>
    </Card>
  );
}

function ExpenseForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  defaultValues: ExpenseInput;
  onSubmit: (data: ExpenseInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    mode: "onChange",
    defaultValues,
  });

  async function submit(data: ExpenseInput) {
    setServerError(null);
    try {
      await onSubmit(data);
    } catch {
      setServerError("Something went wrong. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            inputMode="decimal"
            aria-invalid={!!errors.amount}
            {...register("amount")}
          />
          {errors.amount && (
            <p className="text-[var(--text-sm)] text-[var(--destructive)]">
              {errors.amount.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" aria-invalid={!!errors.date} {...register("date")} />
          {errors.date && (
            <p className="text-[var(--text-sm)] text-[var(--destructive)]">
              {errors.date.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          aria-invalid={!!errors.description}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-[var(--text-sm)] text-[var(--destructive)]">
            {errors.description.message}
          </p>
        )}
      </div>

      {serverError && (
        <p className="text-[var(--text-sm)] text-[var(--destructive)]">{serverError}</p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!isValid || isSubmitting}>
          <Save className="size-4" aria-hidden="true" />
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting}>
            <X className="size-4" aria-hidden="true" />
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
