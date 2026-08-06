"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { expenseSchema, type ExpenseInput } from "@/lib/validation/budget";

export type Expense = {
  id: string;
  amount: string;
  description: string;
  date: string;
};

function formatCurrency(value: string): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

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

export function ExpensesSection({
  initialExpenses,
  onTotalChange,
}: {
  initialExpenses: Expense[];
  // Lets the parent (BudgetPage) keep the remaining-budget calculation
  // (phases-plan 2.3) in sync. Driven by an effect below rather than
  // called at each mutation site, so it can't drift out of sync if a
  // future edit adds another way the list changes.
  onTotalChange?: (total: number) => void;
}) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  useEffect(() => {
    const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    onTotalChange?.(total);
    // onTotalChange is a fresh closure each render from the parent (it
    // captures allocatedFunds); only expenses itself should retrigger
    // this, or every parent re-render would loop back into another call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses]);

  async function handleCreate(data: ExpenseInput) {
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
    // New expenses may land anywhere in date order relative to existing
    // ones, not just at the top — re-sort rather than assuming today's
    // entry is always the most recent date.
    setExpenses((prev) =>
      [...prev, expense].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    );
    setIsAdding(false);
  }

  async function handleUpdate(id: string, data: ExpenseInput) {
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
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setRowError(null);
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setRowError(body?.error ?? "Something went wrong. Try again.");
        return;
      }
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setRowError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card className="rounded-[var(--radius-lg)]">
      <CardContent className="flex flex-col gap-4 p-8">
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-sm)] font-semibold text-[var(--muted-foreground)]">
            Actual expenses
          </span>
          {!isAdding && (
            <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Add expense
            </Button>
          )}
        </div>

        {isAdding && (
          <ExpenseForm
            defaultValues={{ amount: "", description: "", date: "" }}
            onSubmit={handleCreate}
            onCancel={() => setIsAdding(false)}
            submitLabel="Add"
          />
        )}

        {rowError && (
          <p className="text-[var(--text-sm)] text-[var(--destructive)]">{rowError}</p>
        )}

        {expenses.length === 0 && !isAdding ? (
          <p className="py-4 text-center text-[var(--text-sm)] text-[var(--muted-foreground)]">
            No expenses recorded yet.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {expenses.map((expense) =>
              editingId === expense.id ? (
                <div key={expense.id} className="py-4 first:pt-0 last:pb-0">
                  <ExpenseForm
                    defaultValues={{
                      amount: expense.amount,
                      description: expense.description,
                      date: expense.date,
                    }}
                    onSubmit={(data) => handleUpdate(expense.id, data)}
                    onCancel={() => setEditingId(null)}
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
                      ${formatCurrency(expense.amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit expense"
                      onClick={() => setEditingId(expense.id)}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete expense"
                      disabled={deletingId === expense.id}
                      onClick={() => handleDelete(expense.id)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
